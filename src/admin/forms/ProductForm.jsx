/* VETA admin · formulario de producto (crear/editar) + gestor de imágenes.
   Incluye el recortador 4:5 (ImageCropper) y el gestor de subida/reorden
   (ImageManager), que solo usa este formulario. */

import { useState, useEffect, useRef, useCallback } from "react";
import { VETA_DATA } from "../../lib/data.js";
import { db } from "../../lib/db.js";
import { adminToast } from "../toast.jsx";
import {
  MIN_IMAGES,
  MAX_IMAGES,
  CROP_AR,
  CROP_OUT_W,
  CROP_OUT_H,
  compressImage,
  canvasToBlob,
  loadImg,
} from "../images.js";

// ── Editor de recorte/encuadre 4:5 (estilo foto de perfil) ──
function ImageCropper({ url, onCancel, onSave }) {
  const FRAME_W = 320,
    FRAME_H = Math.round(FRAME_W / CROP_AR); // 320 × 400
  const [img, setImg] = useState(null);
  const [base, setBase] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);
  const s = base * zoom;

  const clamp = useCallback(
    (o, sc) => {
      if (!img) return o;
      const dw = img.naturalWidth * sc,
        dh = img.naturalHeight * sc;
      return {
        x: Math.min(0, Math.max(FRAME_W - dw, o.x)),
        y: Math.min(0, Math.max(FRAME_H - dh, o.y)),
      };
    },
    [img]
  );

  useEffect(() => {
    let alive = true;
    loadImg(url)
      .then((im) => {
        if (!alive) return;
        const b = Math.max(FRAME_W / im.naturalWidth, FRAME_H / im.naturalHeight);
        setImg(im);
        setBase(b);
        setZoom(1);
        const dw = im.naturalWidth * b,
          dh = im.naturalHeight * b;
        setOff({ x: (FRAME_W - dw) / 2, y: (FRAME_H - dh) / 2 });
      })
      .catch(() => {
        adminToast("No se pudo abrir el editor de recorte.", true);
        onCancel();
      });
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    setOff((o) => clamp(o, base * zoom));
  }, [zoom, base, clamp]);

  const onDown = (e) => {
    const p = e.touches ? e.touches[0] : e;
    drag.current = { sx: p.clientX, sy: p.clientY, ox: off.x, oy: off.y };
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const p = e.touches ? e.touches[0] : e;
    setOff(
      clamp(
        {
          x: drag.current.ox + (p.clientX - drag.current.sx),
          y: drag.current.oy + (p.clientY - drag.current.sy),
        },
        s
      )
    );
  };
  const onUp = () => {
    drag.current = null;
  };

  const save = async () => {
    if (!img) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = CROP_OUT_W;
      canvas.height = CROP_OUT_H;
      const sx = -off.x / s,
        sy = -off.y / s,
        sw = FRAME_W / s,
        sh = FRAME_H / s;
      canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, CROP_OUT_W, CROP_OUT_H);
      const blob = await canvasToBlob(canvas, "image/webp", 0.85);
      await onSave(blob);
    } catch (e) {
      adminToast("No se pudo recortar: " + e.message, true);
    }
    setBusy(false);
  };

  return (
    <div
      className="adm-modal-ov"
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchMove={onMove}
      onTouchEnd={onUp}
    >
      <div className="adm-crop" onClick={(e) => e.stopPropagation()}>
        <h3 className="adm-form-card-h">Recortar imagen (4:5)</h3>
        <p className="adm-hint" style={{ marginBottom: 12 }}>
          Arrastra para reposicionar y usa el zoom. Se recorta al marco vertical.
        </p>
        <div
          className="adm-crop-frame"
          style={{ width: FRAME_W, height: FRAME_H }}
          onMouseDown={onDown}
          onTouchStart={onDown}
        >
          {img && (
            <img
              src={url}
              draggable={false}
              alt=""
              style={{
                position: "absolute",
                left: off.x,
                top: off.y,
                width: img.naturalWidth * s,
                height: img.naturalHeight * s,
                maxWidth: "none",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          )}
          <div className="adm-crop-grid" />
        </div>
        <label className="adm-lbl" style={{ marginTop: 12 }}>
          Zoom
        </label>
        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          style={{ width: "100%" }}
        />
        <div className="adm-form-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="adm-btn adm-btn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={save}
            disabled={busy || !img}
          >
            {busy ? "Guardando…" : "Aplicar recorte"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gestor nativo de imágenes (arrastrar, comprimir, reordenar, recortar) ──
function ImageManager({ images, setImages, productId, sessionUrls }) {
  const [uploading, setUploading] = useState(0);
  const [cropIdx, setCropIdx] = useState(-1);
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const dragFrom = useRef(null);

  const ingest = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).filter((f) => /^image\//.test(f.type || ""));
      if (!files.length) return;
      let slots = MAX_IMAGES - images.length;
      if (slots <= 0) {
        adminToast(`Máximo ${MAX_IMAGES} imágenes.`, true);
        return;
      }
      const take = files.slice(0, slots);
      if (files.length > slots)
        adminToast(`Solo se agregaron ${slots}; el máximo es ${MAX_IMAGES}.`, true);
      setUploading((u) => u + take.length);
      for (const f of take) {
        try {
          const blob = await compressImage(f);
          const url = await db.uploadProductImage(blob, productId, Math.floor(Math.random() * 1e6));
          sessionUrls.current.add(url);
          setImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, url]));
        } catch (e) {
          adminToast("No se pudo subir una imagen: " + e.message, true);
        } finally {
          setUploading((u) => u - 1);
        }
      }
    },
    [images.length, productId, setImages, sessionUrls]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setOver(false);
    ingest(e.dataTransfer.files);
  };

  const removeAt = (i) => {
    const url = images[i];
    setImages((prev) => prev.filter((_, idx) => idx !== i));
    if (url && sessionUrls.current.has(url)) {
      db.deleteStorageImage(url);
      sessionUrls.current.delete(url);
    }
  };

  const moveTo = (from, to) => {
    if (from == null || from === to) return;
    setImages((prev) => {
      const arr = prev.slice();
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      return arr;
    });
  };

  const onCropSave = async (blob) => {
    const i = cropIdx,
      old = images[i];
    try {
      const url = await db.uploadProductImage(blob, productId, Math.floor(Math.random() * 1e6));
      sessionUrls.current.add(url);
      setImages((prev) => prev.map((u, idx) => (idx === i ? url : u)));
      if (old && sessionUrls.current.has(old)) {
        db.deleteStorageImage(old);
        sessionUrls.current.delete(old);
      }
      adminToast("Imagen recortada.");
    } catch (e) {
      adminToast("No se pudo guardar el recorte: " + e.message, true);
    }
    setCropIdx(-1);
  };

  const full = images.length >= MAX_IMAGES;

  return (
    <>
      <div
        className={`adm-dropzone${over ? " adm-dropzone--over" : ""}${full ? " adm-dropzone--disabled" : ""}`}
        role="button"
        tabIndex={full ? -1 : 0}
        aria-label="Agregar imágenes de producto"
        onDragOver={(e) => {
          if (full) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (full) {
            e.preventDefault();
            return;
          }
          onDrop(e);
        }}
        onClick={() => {
          if (!full) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (full) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            ingest(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="adm-dropzone-ico">⬇</div>
        <div>
          {full ? (
            `Llegaste al máximo de ${MAX_IMAGES} imágenes`
          ) : (
            <>
              Arrastra imágenes aquí o <strong>haz clic para elegir</strong>
            </>
          )}
        </div>
        <span className="adm-field-hint">
          JPG/PNG · se comprimen automáticamente · {images.length}/{MAX_IMAGES}
        </span>
        {uploading > 0 && <span className="adm-field-hint">Subiendo {uploading}…</span>}
      </div>

      {images.length > 0 && (
        <div className="adm-img-grid">
          {images.map((url, i) => (
            <div
              key={url}
              className="adm-img-card"
              draggable
              onDragStart={() => {
                dragFrom.current = i;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                moveTo(dragFrom.current, i);
                dragFrom.current = null;
              }}
            >
              <div className="adm-img-card-thumb">
                <img src={url} alt="" draggable={false} />
              </div>
              {i === 0 && <span className="adm-img-card-badge">Principal</span>}
              <span className="adm-img-card-num">{i + 1}</span>
              <div className="adm-img-card-actions">
                <button
                  type="button"
                  className="adm-mini-btn"
                  onClick={() => setCropIdx(i)}
                  title="Recortar / encuadrar"
                  aria-label={`Recortar imagen ${i + 1}`}
                >
                  ✎ Editar
                </button>
                <button
                  type="button"
                  className="adm-mini-btn adm-mini-btn--del"
                  onClick={() => removeAt(i)}
                  title="Eliminar"
                  aria-label={`Eliminar imagen ${i + 1}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="adm-field-hint" style={{ marginTop: 8 }}>
        Arrastra las miniaturas para reordenar — la primera es la imagen principal del catálogo.
        Mínimo {MIN_IMAGES}, máximo {MAX_IMAGES}.
      </p>

      {cropIdx >= 0 && images[cropIdx] && (
        <ImageCropper url={images[cropIdx]} onCancel={() => setCropIdx(-1)} onSave={onCropSave} />
      )}
    </>
  );
}

// ── Formulario de producto (crear / editar) ────────────────
export function ProductForm({ product, allProducts, onSave, onBack }) {
  const isNew = !product;

  const catList0 = db.getCategories(1) || VETA_DATA.categories;

  const initForm = useCallback(
    (p) => ({
      name: p?.name || "",
      cat: p?.cat || (catList0[0] && catList0[0].id) || "",
      subcat: p?.subcat || "",
      ref: p?.ref || "",
      material: p?.material || VETA_DATA.materials[0],
      matMode: p?.material && !VETA_DATA.materials.includes(p.material) ? "custom" : "preset",
      finish: p?.finish || VETA_DATA.finishes[0],
      finMode: p?.finish && !VETA_DATA.finishes.includes(p.finish) ? "custom" : "preset",
      price: p?.price || "",
      sizesStr: (p?.sizes || []).join(", "),
      blurb: p?.blurb || "",
      desc: p?.desc || "",
      images: VETA_DATA.productImages(p), // array dinámico de URLs (0 = principal)
    }),
    []
  );

  const [form, setFormRaw] = useState(() => initForm(product));
  const [id, setId] = useState(product?.id || "");
  const [errors, setErrors] = useState({});
  const sessionUrls = useRef(new Set());

  const set = useCallback((k, v) => setFormRaw((f) => ({ ...f, [k]: v })), []);
  // setImages compatible con actualizaciones funcionales (lo usa ImageManager).
  const setImages = useCallback((updater) => {
    setFormRaw((f) => ({
      ...f,
      images: typeof updater === "function" ? updater(f.images) : updater,
    }));
  }, []);

  // Re-render cuando las categorías cargan/cambian desde Supabase.
  const [, forceTick] = useState(0);
  useEffect(() => db.subscribe(() => forceTick((n) => n + 1)), []);

  // Auto-generar ID cuando cambia la categoría (solo productos nuevos)
  useEffect(() => {
    if (!isNew) return;
    const pfx = db.getCategoryPrefix(form.cat) || "prod";
    const nums = allProducts
      .filter((p) => p.id.startsWith(pfx + "-"))
      .map((p) => {
        const n = parseInt(p.id.split("-")[1], 10);
        return isNaN(n) ? 0 : n;
      });
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    setId(`${pfx}-${String(next).padStart(2, "0")}`);
  }, [form.cat, isNew]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "El nombre es obligatorio.";
    if (!form.price || Number(form.price) <= 0) e.price = "El precio debe ser mayor a 0.";
    if (!form.sizesStr.trim()) e.sizes = "Agrega al menos una talla.";
    if (!form.images || form.images.length < MIN_IMAGES)
      e.images = `Agrega al menos ${MIN_IMAGES} imágenes.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const sizes = form.sizesStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onSave({
      id,
      name: form.name.trim(),
      cat: form.cat,
      subcat: form.subcat || null,
      ref: form.ref || null,
      material: form.material,
      finish: form.finish,
      price: parseInt(form.price, 10),
      sizes,
      blurb: form.blurb.trim(),
      desc: form.desc.trim(),
      images: form.images,
    });
  };

  const sizeChips = form.sizesStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const catList = db.getCategories(1) || VETA_DATA.categories;
  const subcats = db.getChildren(form.cat);
  const refs = db.getChildren(form.subcat);

  return (
    <div className="adm-page">
      <div className="adm-form-topbar">
        <button type="button" className="adm-back-btn" onClick={onBack}>
          ← Volver
        </button>
        <h2 className="adm-form-title">{isNew ? "Nuevo producto" : `Editar · ${product.name}`}</h2>
      </div>

      <form onSubmit={handleSubmit} className="adm-product-form">
        {/* ── Información básica ── */}
        <div className="adm-form-card">
          <h3 className="adm-form-card-h">Información básica</h3>
          <div className="adm-form-grid">
            <div className="adm-form-field adm-form-field--full">
              <label className="adm-lbl">
                Nombre <span className="adm-required">*</span>
              </label>
              <input
                className={`adm-input${errors.name ? " adm-input--err" : ""}`}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ej: Anillo Vena"
                name="product-name"
                autoComplete="off"
              />
              {errors.name && <span className="adm-field-err">{errors.name}</span>}
            </div>

            <div className="adm-form-field adm-form-field--full">
              <label className="adm-lbl">
                Precio <span className="adm-required">*</span>
              </label>
              <div className="adm-price-row">
                <input
                  className={`adm-input${errors.price ? " adm-input--err" : ""}`}
                  type="number"
                  min="0"
                  step="1000"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder="180000"
                  name="product-price"
                  inputMode="numeric"
                  autoComplete="off"
                  style={{ maxWidth: 220 }}
                />
                <span className="adm-price-cur">COP</span>
                {Number(form.price) > 0 && (
                  <span className="adm-field-hint" style={{ margin: 0 }}>
                    {VETA_DATA.fmtPrice(Number(form.price))} COP
                  </span>
                )}
              </div>
              {errors.price && <span className="adm-field-err">{errors.price}</span>}
            </div>

            <div className="adm-form-field">
              <label className="adm-lbl">ID del producto</label>
              <input
                className="adm-input adm-input--mono"
                value={id}
                readOnly
                style={{ color: "var(--ink-faint)" }}
                name="product-id"
                autoComplete="off"
              />
              <span className="adm-field-hint">Generado automáticamente</span>
            </div>

            <div className="adm-form-field">
              <label className="adm-lbl">Categoría</label>
              <select
                className="adm-input"
                value={form.cat}
                onChange={(e) =>
                  setFormRaw((f) => ({ ...f, cat: e.target.value, subcat: "", ref: "" }))
                }
              >
                {catList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="adm-form-field">
              <label className="adm-lbl">
                Subcategoría <span className="adm-field-hint-inline">— opcional</span>
              </label>
              <select
                className="adm-input"
                value={form.subcat}
                disabled={subcats.length === 0}
                onChange={(e) => setFormRaw((f) => ({ ...f, subcat: e.target.value, ref: "" }))}
              >
                <option value="">
                  {subcats.length ? "— Sin subcategoría —" : "— No hay subcategorías —"}
                </option>
                {subcats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="adm-form-field">
              <label className="adm-lbl">
                Referencia <span className="adm-field-hint-inline">— opcional</span>
              </label>
              <select
                className="adm-input"
                value={form.ref}
                disabled={refs.length === 0}
                onChange={(e) => set("ref", e.target.value)}
              >
                <option value="">
                  {refs.length ? "— Sin referencia —" : "— No hay referencias —"}
                </option>
                {refs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="adm-form-field">
              <label className="adm-lbl">Material</label>
              <select
                className="adm-input"
                value={form.matMode === "custom" ? "__custom__" : form.material}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    set("matMode", "custom");
                    set("material", "");
                  } else {
                    set("matMode", "preset");
                    set("material", e.target.value);
                  }
                }}
              >
                {VETA_DATA.materials.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="__custom__">Otro…</option>
              </select>
              {form.matMode === "custom" && (
                <input
                  className="adm-input adm-input--sm"
                  style={{ marginTop: 6 }}
                  placeholder="Ej: Titanio, Cobre, …"
                  value={form.material}
                  onChange={(e) => set("material", e.target.value)}
                />
              )}
            </div>

            <div className="adm-form-field">
              <label className="adm-lbl">Acabado</label>
              <select
                className="adm-input"
                value={form.finMode === "custom" ? "__custom__" : form.finish}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    set("finMode", "custom");
                    set("finish", "");
                  } else {
                    set("finMode", "preset");
                    set("finish", e.target.value);
                  }
                }}
              >
                {VETA_DATA.finishes.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                <option value="__custom__">Otro…</option>
              </select>
              {form.finMode === "custom" && (
                <input
                  className="adm-input adm-input--sm"
                  style={{ marginTop: 6 }}
                  placeholder="Ej: Envejecido, Oxidado, …"
                  value={form.finish}
                  onChange={(e) => set("finish", e.target.value)}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Contenido ── */}
        <div className="adm-form-card">
          <h3 className="adm-form-card-h">Contenido</h3>
          <div className="adm-form-field">
            <label className="adm-lbl">
              Tagline <span className="adm-field-hint-inline">— frase corta (1-2 líneas)</span>
            </label>
            <input
              className="adm-input"
              value={form.blurb}
              onChange={(e) => set("blurb", e.target.value)}
              placeholder="Ej: Una línea sobre la piel, fina y precisa."
            />
          </div>
          <div className="adm-form-field" style={{ marginTop: 10 }}>
            <label className="adm-lbl">Descripción completa</label>
            <textarea
              className="adm-input adm-textarea"
              rows={4}
              value={form.desc}
              onChange={(e) => set("desc", e.target.value)}
              placeholder="Descripción detallada: materiales, proceso, detalles de fabricación…"
            />
          </div>
        </div>

        {/* ── Tallas ── */}
        <div className="adm-form-card">
          <h3 className="adm-form-card-h">Tallas / Largos</h3>
          <div className="adm-form-field">
            <label className="adm-lbl">
              Tallas disponibles <span className="adm-required">*</span>
            </label>
            <input
              className={`adm-input${errors.sizes ? " adm-input--err" : ""}`}
              value={form.sizesStr}
              onChange={(e) => set("sizesStr", e.target.value)}
              placeholder="5, 6, 7, 8, 9  —  40cm, 45cm, 50cm  —  S, M, L  —  único"
            />
            <span className="adm-field-hint">Separar por comas</span>
            {errors.sizes && <span className="adm-field-err">{errors.sizes}</span>}
          </div>
          {sizeChips.length > 0 && (
            <div className="adm-size-preview">
              {sizeChips.map((s, i) => (
                <span key={i} className="adm-size-chip-prev">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Imágenes ── */}
        <div className="adm-form-card">
          <h3 className="adm-form-card-h">Imágenes</h3>
          <p className="adm-hint" style={{ marginBottom: 14 }}>
            Arrastra las fotos desde tu computador. Se comprimen automáticamente sin perder calidad
            y se suben a la nube. Reordénalas para elegir cuál va primero y usa{" "}
            <strong>Editar</strong>
            para recortar cada una al marco vertical.
          </p>
          <ImageManager
            images={form.images}
            setImages={setImages}
            productId={id}
            sessionUrls={sessionUrls}
          />
          {errors.images && <span className="adm-field-err">{errors.images}</span>}
        </div>

        {/* ── Acciones ── */}
        <div className="adm-form-actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onBack}>
            Cancelar
          </button>
          <button type="submit" className="adm-btn adm-btn--primary">
            {isNew ? "Crear producto" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
