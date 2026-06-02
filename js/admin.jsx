/* VETA · Panel de administración — Prototipo localStorage
   Para producción: migrar a Supabase u otro backend.      */

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ── Storage keys ──────────────────────────────────────────
const ADM = {
  hash:     "veta-admin-hash",
  session:  "veta-admin-session",
  stock:    "veta-stock",
  hidden:   "veta-hidden",
  settings: "veta-adm-cfg",
  products: "veta-products",          // lista de productos (override del catálogo)
};
const DEFAULT_PW = "veta2026";

// ── Helpers ───────────────────────────────────────────────
async function sha256(msg) {
  const buf = await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(msg)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}
function rd(key, fb = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fb; }
  catch { return fb; }
}
function wr(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// Seed inicial: agrega campo images a los productos de data.js
function seedProducts() {
  return VETA_DATA.products.map(p => ({ ...p, images: p.images || {} }));
}

// ── API pública (utilizada por el sitio público) ──────────
window.VETA_ADMIN = {
  getProducts() {
    try {
      const stored = localStorage.getItem(ADM.products);
      if (stored) return JSON.parse(stored);
    } catch {}
    return VETA_DATA.products;
  },
  getStock(pid, sz) {
    const v = (rd(ADM.stock, {}))[`${pid}::${sz}`];
    return v === undefined ? null : v;
  },
  isHidden(pid) { return rd(ADM.hidden, []).includes(pid); },
};

// ── Auth ──────────────────────────────────────────────────
async function ensurePw() {
  let stored = localStorage.getItem(ADM.hash);
  if (stored && stored.startsWith('"')) {
    stored = JSON.parse(stored);
    localStorage.setItem(ADM.hash, stored);
  }
  if (!stored) localStorage.setItem(ADM.hash, await sha256(DEFAULT_PW));
}

function useAuth() {
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem(ADM.session));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const login = useCallback(async (pw) => {
    setLoading(true); setErr("");
    try {
      await ensurePw();
      const hash = await sha256(pw);
      if (hash === localStorage.getItem(ADM.hash)) {
        sessionStorage.setItem(ADM.session,
          typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now().toString(36)
        );
        setAuthed(true);
      } else setErr("Contraseña incorrecta.");
    } catch { setErr("Error de verificación. Intenta de nuevo."); }
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(ADM.session);
    setAuthed(false);
  }, []);

  return { authed, loading, err, login, logout };
}

// ── Data hooks ────────────────────────────────────────────
function useProductCRUD() {
  const [products, setProducts] = useState(() => {
    try {
      const stored = localStorage.getItem(ADM.products);
      if (stored) return JSON.parse(stored);
    } catch {}
    return seedProducts();
  });

  const persist = (list) => {
    try {
      localStorage.setItem(ADM.products, JSON.stringify(list));
      setProducts(list);
    } catch (e) {
      if (e.name === "QuotaExceededError")
        alert("Almacenamiento lleno. Usa URLs de imágenes en lugar de archivos locales.");
    }
  };

  const add    = useCallback((p) => persist([...products, p]), [products]);
  const update = useCallback((id, data) => persist(products.map(p => p.id === id ? { ...p, ...data } : p)), [products]);
  const remove = useCallback((id) => persist(products.filter(p => p.id !== id)), [products]);

  const generateId = useCallback((cat) => {
    const pfx = { anillos:"an", collares:"co", aretes:"ar", pulseras:"pu", piercings:"pi" }[cat] || "prod";
    const nums = products
      .filter(p => p.id.startsWith(pfx + "-"))
      .map(p => { const n = parseInt(p.id.split("-")[1], 10); return isNaN(n) ? 0 : n; });
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `${pfx}-${String(next).padStart(2, "0")}`;
  }, [products]);

  const resetToSeed = useCallback(() => {
    persist(seedProducts());
  }, []);

  return { products, add, update, remove, generateId, resetToSeed };
}

function useHidden() {
  const [hidden, setHiddenRaw] = useState(() => rd(ADM.hidden, []));
  const toggle = useCallback((id) => {
    setHiddenRaw(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      wr(ADM.hidden, next);
      return next;
    });
  }, []);
  return { hidden, toggle };
}

function useStock() {
  const [stock, setStockRaw] = useState(() => rd(ADM.stock, {}));
  const set = useCallback((pid, sz, qty) => {
    setStockRaw(prev => {
      const k = `${pid}::${sz}`;
      const next = { ...prev };
      if (qty < 0) delete next[k]; else next[k] = Math.max(0, qty);
      wr(ADM.stock, next); return next;
    });
  }, []);
  const get   = useCallback((pid, sz) => { const v = stock[`${pid}::${sz}`]; return v === undefined ? "" : v; }, [stock]);
  const reset = useCallback(() => { wr(ADM.stock, {}); setStockRaw({}); }, []);
  return { stock, set, get, reset };
}

function useCfg() {
  const [cfg, setCfgRaw] = useState(() => ({ wa_phone: "573246206702", ...rd(ADM.settings, {}) }));
  const save = useCallback((patch) => {
    setCfgRaw(prev => { const next = { ...prev, ...patch }; wr(ADM.settings, next); return next; });
  }, []);
  return { cfg, save };
}

// ── Login ─────────────────────────────────────────────────
function AdminLogin({ onLogin, loading, err }) {
  const [pw, setPw] = useState("");
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="adm-login-wrap">
      <div className="adm-login-card">
        <div className="adm-login-logo">VETA</div>
        <p className="adm-login-sub">Panel de administración</p>
        <form onSubmit={e => { e.preventDefault(); pw && onLogin(pw); }}>
          <label className="adm-lbl" htmlFor="adm-pw">Contraseña</label>
          <input id="adm-pw" ref={ref} type="password" className="adm-input"
            value={pw} onChange={e => setPw(e.target.value)}
            placeholder="••••••••" autoComplete="current-password" />
          {err && <p className="adm-msg adm-msg--err">{err}</p>}
          <button type="submit" className="adm-btn adm-btn--primary" disabled={loading || !pw}>
            {loading ? "Verificando…" : "Entrar"}
          </button>
        </form>
        <a href="#home" className="adm-back-link">← Volver al sitio</a>
      </div>
    </div>
  );
}

// ── Tab: Inicio ───────────────────────────────────────────
function TabInicio({ products, stock }) {
  const total   = products.length;
  const visible = products.filter(p => !p.hidden).length;
  const ocultos = total - visible;
  const stEntries = Object.entries(stock);
  const agotados  = stEntries.filter(([, v]) => v === 0).length;
  const bajos     = stEntries.filter(([, v]) => v > 0 && v <= 2).length;
  const bycat = {};
  products.forEach(p => { bycat[p.cat] = (bycat[p.cat] || 0) + 1; });

  return (
    <div className="adm-page">
      <div className="adm-stats-grid">
        <div className="adm-stat"><span className="adm-stat-n">{total}</span><span className="adm-stat-l">Total productos</span></div>
        <div className="adm-stat"><span className="adm-stat-n">{visible}</span><span className="adm-stat-l">Visibles en tienda</span></div>
        <div className="adm-stat"><span className="adm-stat-n">{ocultos}</span><span className="adm-stat-l">Ocultos</span></div>
        <div className={`adm-stat${agotados > 0 ? " adm-stat--warn" : ""}`}><span className="adm-stat-n">{agotados}</span><span className="adm-stat-l">Agotados (0 und.)</span></div>
        <div className={`adm-stat${bajos > 0 ? " adm-stat--warn" : ""}`}><span className="adm-stat-n">{bajos}</span><span className="adm-stat-l">Stock bajo (≤2 und.)</span></div>
      </div>
      <h3 className="adm-sub-h">Por categoría</h3>
      <div className="adm-card">
        <table className="adm-table">
          <thead><tr><th>Categoría</th><th>Productos</th></tr></thead>
          <tbody>
            {Object.entries(bycat).map(([cat, n]) => (
              <tr key={cat}><td style={{ textTransform:"capitalize" }}>{cat}</td><td>{n}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {agotados > 0 && (
        <div className="adm-alert">⚠ {agotados} talla(s) con stock en cero. Revisa la pestaña <strong>Stock</strong>.</div>
      )}
      <p className="adm-note">
        <strong>Borrador:</strong> datos en este navegador (localStorage). Para producción migrar a Supabase.
      </p>
    </div>
  );
}

// ── Preview de imagen ──────────────────────────────────────
function ImgPreview({ url }) {
  const [status, setStatus] = useState("empty");
  useEffect(() => { setStatus(url ? "loading" : "empty"); }, [url]);

  return (
    <div className="adm-img-prev">
      {!url && <span className="adm-img-prev__txt">Sin imagen</span>}
      {url && status !== "ok" && !url.startsWith("data:") &&
        <span className="adm-img-prev__txt">{status === "error" ? "URL inválida" : "…"}</span>
      }
      {url && (
        <img key={url} src={url} alt=""
          style={{ display: status === "ok" ? "block" : "none" }}
          onLoad={() => setStatus("ok")}
          onError={() => setStatus("error")} />
      )}
    </div>
  );
}

// ── Formulario de producto (crear / editar) ────────────────
const IMG_VIEWS = [
  { key: "main",    label: "Principal",                  hint: "Imagen principal — aparece en el catálogo y como vista 1 en PDP" },
  { key: "profile", label: "Perfil (vista 2)",           hint: "Vista de perfil o ángulo lateral" },
  { key: "detail",  label: "Detalle de acabado (vista 3)", hint: "Macro del acabado o textura" },
  { key: "context", label: "En uso / contexto (vista 4)", hint: "Foto de la pieza siendo usada" },
];

function ProductForm({ product, allProducts, onSave, onBack }) {
  const isNew = !product;

  const initForm = useCallback((p) => ({
    name:     p?.name || "",
    cat:      p?.cat  || VETA_DATA.categories[0].id,
    material: p?.material || VETA_DATA.materials[0],
    matMode:  (p?.material && !VETA_DATA.materials.includes(p.material)) ? "custom" : "preset",
    finish:   p?.finish || VETA_DATA.finishes[0],
    finMode:  (p?.finish && !VETA_DATA.finishes.includes(p.finish)) ? "custom" : "preset",
    price:    p?.price  || "",
    sizesStr: (p?.sizes || []).join(", "),
    blurb:    p?.blurb  || "",
    desc:     p?.desc   || "",
    imgMain:    p?.images?.main    || "",
    imgProfile: p?.images?.profile || "",
    imgDetail:  p?.images?.detail  || "",
    imgContext: p?.images?.context || "",
  }), []);

  const [form, setFormRaw] = useState(() => initForm(product));
  const [id, setId] = useState(product?.id || "");
  const [errors, setErrors] = useState({});

  const set = useCallback((k, v) => setFormRaw(f => ({ ...f, [k]: v })), []);

  // Auto-generar ID cuando cambia la categoría (solo productos nuevos)
  useEffect(() => {
    if (!isNew) return;
    const pfx = { anillos:"an", collares:"co", aretes:"ar", pulseras:"pu", piercings:"pi" }[form.cat] || "prod";
    const nums = allProducts
      .filter(p => p.id.startsWith(pfx + "-"))
      .map(p => { const n = parseInt(p.id.split("-")[1], 10); return isNaN(n) ? 0 : n; });
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    setId(`${pfx}-${String(next).padStart(2, "0")}`);
  }, [form.cat, isNew]);

  const validate = () => {
    const e = {};
    if (!form.name.trim())           e.name  = "El nombre es obligatorio.";
    if (!form.price || Number(form.price) <= 0) e.price = "El precio debe ser mayor a 0.";
    if (!form.sizesStr.trim())       e.sizes = "Agrega al menos una talla.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const sizes = form.sizesStr.split(",").map(s => s.trim()).filter(Boolean);
    onSave({
      id,
      name:     form.name.trim(),
      cat:      form.cat,
      material: form.material,
      finish:   form.finish,
      price:    parseInt(form.price, 10),
      sizes,
      blurb:    form.blurb.trim(),
      desc:     form.desc.trim(),
      images: {
        main:    form.imgMain.trim(),
        profile: form.imgProfile.trim(),
        detail:  form.imgDetail.trim(),
        context: form.imgContext.trim(),
      },
    });
  };

  const sizeChips = form.sizesStr.split(",").map(s => s.trim()).filter(Boolean);
  const imgKeys   = ["imgMain", "imgProfile", "imgDetail", "imgContext"];

  return (
    <div className="adm-page">
      <div className="adm-form-topbar">
        <button type="button" className="adm-back-btn" onClick={onBack}>← Volver</button>
        <h2 className="adm-form-title">
          {isNew ? "Nuevo producto" : `Editar · ${product.name}`}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="adm-product-form">

        {/* ── Información básica ── */}
        <div className="adm-form-card">
          <h3 className="adm-form-card-h">Información básica</h3>
          <div className="adm-form-grid">

            <div className="adm-form-field adm-form-field--full">
              <label className="adm-lbl">Nombre <span className="adm-required">*</span></label>
              <input className={`adm-input${errors.name ? " adm-input--err" : ""}`}
                value={form.name} onChange={e => set("name", e.target.value)}
                placeholder="Ej: Anillo Vena" />
              {errors.name && <span className="adm-field-err">{errors.name}</span>}
            </div>

            <div className="adm-form-field">
              <label className="adm-lbl">ID del producto</label>
              <input className="adm-input adm-input--mono" value={id} readOnly
                style={{ color:"var(--ink-faint)" }} />
              <span className="adm-field-hint">Generado automáticamente</span>
            </div>

            <div className="adm-form-field">
              <label className="adm-lbl">Categoría</label>
              <select className="adm-input" value={form.cat}
                onChange={e => set("cat", e.target.value)}>
                {VETA_DATA.categories.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="adm-form-field">
              <label className="adm-lbl">Material</label>
              <select className="adm-input"
                value={form.matMode === "custom" ? "__custom__" : form.material}
                onChange={e => {
                  if (e.target.value === "__custom__") { set("matMode","custom"); set("material",""); }
                  else { set("matMode","preset"); set("material", e.target.value); }
                }}>
                {VETA_DATA.materials.map(m => <option key={m} value={m}>{m}</option>)}
                <option value="__custom__">Otro…</option>
              </select>
              {form.matMode === "custom" && (
                <input className="adm-input adm-input--sm" style={{ marginTop:6 }}
                  placeholder="Ej: Titanio, Cobre, …"
                  value={form.material} onChange={e => set("material", e.target.value)} />
              )}
            </div>

            <div className="adm-form-field">
              <label className="adm-lbl">Acabado</label>
              <select className="adm-input"
                value={form.finMode === "custom" ? "__custom__" : form.finish}
                onChange={e => {
                  if (e.target.value === "__custom__") { set("finMode","custom"); set("finish",""); }
                  else { set("finMode","preset"); set("finish", e.target.value); }
                }}>
                {VETA_DATA.finishes.map(f => <option key={f} value={f}>{f}</option>)}
                <option value="__custom__">Otro…</option>
              </select>
              {form.finMode === "custom" && (
                <input className="adm-input adm-input--sm" style={{ marginTop:6 }}
                  placeholder="Ej: Envejecido, Oxidado, …"
                  value={form.finish} onChange={e => set("finish", e.target.value)} />
              )}
            </div>

            <div className="adm-form-field">
              <label className="adm-lbl">Precio <span className="adm-required">*</span></label>
              <div className="adm-price-row">
                <input className={`adm-input${errors.price ? " adm-input--err" : ""}`}
                  type="number" min="0" step="1000"
                  value={form.price} onChange={e => set("price", e.target.value)}
                  placeholder="180000" />
                <span className="adm-price-cur">COP</span>
              </div>
              {Number(form.price) > 0 &&
                <span className="adm-field-hint">{VETA_DATA.fmtPrice(Number(form.price))} COP</span>}
              {errors.price && <span className="adm-field-err">{errors.price}</span>}
            </div>

          </div>
        </div>

        {/* ── Contenido ── */}
        <div className="adm-form-card">
          <h3 className="adm-form-card-h">Contenido</h3>
          <div className="adm-form-field">
            <label className="adm-lbl">Tagline <span className="adm-field-hint-inline">— frase corta (1-2 líneas)</span></label>
            <input className="adm-input" value={form.blurb}
              onChange={e => set("blurb", e.target.value)}
              placeholder="Ej: Una línea sobre la piel, fina y precisa." />
          </div>
          <div className="adm-form-field" style={{ marginTop:10 }}>
            <label className="adm-lbl">Descripción completa</label>
            <textarea className="adm-input adm-textarea" rows={4} value={form.desc}
              onChange={e => set("desc", e.target.value)}
              placeholder="Descripción detallada: materiales, proceso, detalles de fabricación…" />
          </div>
        </div>

        {/* ── Tallas ── */}
        <div className="adm-form-card">
          <h3 className="adm-form-card-h">Tallas / Largos</h3>
          <div className="adm-form-field">
            <label className="adm-lbl">Tallas disponibles <span className="adm-required">*</span></label>
            <input className={`adm-input${errors.sizes ? " adm-input--err" : ""}`}
              value={form.sizesStr} onChange={e => set("sizesStr", e.target.value)}
              placeholder="5, 6, 7, 8, 9  —  40cm, 45cm, 50cm  —  S, M, L  —  único" />
            <span className="adm-field-hint">Separar por comas</span>
            {errors.sizes && <span className="adm-field-err">{errors.sizes}</span>}
          </div>
          {sizeChips.length > 0 && (
            <div className="adm-size-preview">
              {sizeChips.map((s, i) => <span key={i} className="adm-size-chip-prev">{s}</span>)}
            </div>
          )}
        </div>

        {/* ── Imágenes ── */}
        <div className="adm-form-card">
          <h3 className="adm-form-card-h">Imágenes</h3>
          <p className="adm-hint" style={{ marginBottom:14 }}>
            Sube las fotos a <strong>Cloudinary</strong> (gratis en <code className="adm-code">cloudinary.com</code>)
            y pega aquí el URL directo de cada imagen. Si no hay imagen, se muestra el placeholder SVG.
          </p>
          <div className="adm-img-fields">
            {IMG_VIEWS.map(({ key, label, hint }, i) => (
              <div key={key} className="adm-img-field-row">
                <ImgPreview url={form[imgKeys[i]]} />
                <div className="adm-img-field-inputs">
                  <label className="adm-lbl">{label}</label>
                  <span className="adm-field-hint" style={{ marginBottom:4 }}>{hint}</span>
                  <input className="adm-input adm-input--sm" type="url"
                    value={form[imgKeys[i]]}
                    onChange={e => set(imgKeys[i], e.target.value)}
                    placeholder="https://res.cloudinary.com/tu-cuenta/…" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Acciones ── */}
        <div className="adm-form-actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onBack}>Cancelar</button>
          <button type="submit" className="adm-btn adm-btn--primary">
            {isNew ? "Crear producto" : "Guardar cambios"}
          </button>
        </div>

      </form>
    </div>
  );
}

// ── Tab: Productos (CRUD) ─────────────────────────────────
function TabProductos({ products, addProduct, updateProduct, removeProduct, toggleHidden }) {
  const [view, setView] = useState("list");  // "list" | "new" | <product-obj>
  const [q, setQ]       = useState("");
  const [cat, setCat]   = useState("todas");

  const cats = ["todas", ...VETA_DATA.categories.map(c => c.id)];
  const filtered = products.filter(p => {
    const mq = !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.id.includes(q);
    const mc = cat === "todas" || p.cat === cat;
    return mq && mc;
  });

  const handleDelete = (p) => {
    if (window.confirm(`¿Eliminar "${p.name}"? No se puede deshacer.`)) removeProduct(p.id);
  };

  // Mostrar formulario
  if (view === "new" || (view && typeof view === "object")) {
    return (
      <ProductForm
        product={typeof view === "object" ? view : null}
        allProducts={products}
        onSave={(data) => {
          if (typeof view === "object") updateProduct(data.id, data);
          else addProduct(data);
          setView("list");
        }}
        onBack={() => setView("list")}
      />
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-toolbar">
        <input className="adm-input adm-input--sm" placeholder="Buscar producto…"
          value={q} onChange={e => setQ(e.target.value)} />
        <div className="adm-pills">
          {cats.map(c => (
            <button key={c} className={`adm-pill${cat===c?" adm-pill--on":""}`}
              onClick={() => setCat(c)} style={{ textTransform:"capitalize" }}>{c}</button>
          ))}
        </div>
        <button className="adm-btn adm-btn--primary adm-btn--sm" style={{ marginLeft:"auto" }}
          onClick={() => setView("new")}>
          + Nuevo producto
        </button>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Img.</th><th>Nombre</th><th>Cat.</th><th>Material</th>
              <th>Precio</th><th>Tallas</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className={p.hidden ? "adm-row--dim" : ""}>
                <td>
                  <div className="adm-prod-thumb">
                    {p.images?.main
                      ? <img src={p.images.main} alt={p.name} />
                      : <PHShape kind={VETA_DATA.shapes[p.cat]?.kind || "ring"} />}
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight:500 }}>{p.name}</div>
                  <code className="adm-code">{p.id}</code>
                </td>
                <td style={{ textTransform:"capitalize", color:"var(--ink-soft)" }}>{p.cat}</td>
                <td style={{ color:"var(--ink-soft)" }}>{p.material}</td>
                <td>{VETA_DATA.fmtPrice(p.price)}</td>
                <td className="adm-sizes-cell">{p.sizes.join(" · ")}</td>
                <td>
                  <button className={`adm-badge${p.hidden?"":" adm-badge--on"}`}
                    onClick={() => toggleHidden(p.id)}>
                    {p.hidden ? "Oculto" : "Visible"}
                  </button>
                </td>
                <td>
                  <div className="adm-row-actions">
                    <button className="adm-action-btn" onClick={() => setView(p)} title="Editar">✏</button>
                    <button className="adm-action-btn adm-action-btn--del" onClick={() => handleDelete(p)} title="Eliminar">✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="adm-empty">
            {q ? `Sin resultados para "${q}".` : "No hay productos. ¡Agrega el primero!"}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Tab: Stock ────────────────────────────────────────────
function StockCell({ pid, sz, get, set }) {
  const val = get(pid, sz);
  const [edit, setEdit] = useState(false);
  const [local, setLocal] = useState("");
  const cls = val===""?"adm-sc--nd":val===0?"adm-sc--zero":val<=2?"adm-sc--low":"adm-sc--ok";
  const commit = () => {
    const s = local.trim();
    if (s==="") set(pid,sz,-1);
    else { const n=parseInt(s,10); if(!isNaN(n)&&n>=0) set(pid,sz,n); }
    setEdit(false);
  };
  if (edit) return (
    <input type="number" min="0" className="adm-sc-inp"
      value={local} onChange={e=>setLocal(e.target.value)} onBlur={commit}
      onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape")setEdit(false);}}
      autoFocus />
  );
  return (
    <button className={`adm-sc ${cls}`} title="Clic para editar"
      onClick={() => { setLocal(val===""?"":String(val)); setEdit(true); }}>
      {val===""?"—":val}
    </button>
  );
}

function TabStock({ products, get, set, reset }) {
  const [cat, setCat] = useState("todas");
  const cats = ["todas", ...VETA_DATA.categories.map(c => c.id)];
  const filtered = cat==="todas" ? products : products.filter(p=>p.cat===cat);
  return (
    <div className="adm-page">
      <div className="adm-toolbar">
        <div className="adm-pills">
          {cats.map(c=>(
            <button key={c} className={`adm-pill${cat===c?" adm-pill--on":""}`}
              onClick={()=>setCat(c)} style={{textTransform:"capitalize"}}>{c}</button>
          ))}
        </div>
        <button className="adm-btn adm-btn--ghost adm-btn--sm"
          onClick={()=>window.confirm("¿Limpiar todo el stock definido?")&&reset()}>
          Limpiar todo
        </button>
      </div>
      <p className="adm-legend-row">
        <span>Leyenda:</span>
        <span className="adm-sc adm-sc--ok"  style={{pointerEvents:"none"}}>4+</span><span>Disponible</span>
        <span className="adm-sc adm-sc--low" style={{pointerEvents:"none"}}>≤2</span><span>Stock bajo</span>
        <span className="adm-sc adm-sc--zero"style={{pointerEvents:"none"}}>0</span><span>Agotado</span>
        <span className="adm-sc adm-sc--nd"  style={{pointerEvents:"none"}}>—</span><span>Sin definir</span>
      </p>
      <div className="adm-stock-list">
        {filtered.map(p=>(
          <div key={p.id} className="adm-stock-row">
            <div className="adm-stock-prod">
              <span className="adm-stock-name">{p.name}</span>
              <span className="adm-stock-meta">
                <code className="adm-code">{p.id}</code>
                <span style={{textTransform:"capitalize"}}>{p.cat}</span>
              </span>
            </div>
            <div className="adm-stock-sizes">
              {p.sizes.map(sz=>(
                <div key={sz} className="adm-size-item">
                  <span className="adm-size-lbl">{sz}</span>
                  <StockCell pid={p.id} sz={sz} get={get} set={set}/>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Configuración ────────────────────────────────────
function ChangePwForm() {
  const [cur,setCur]=useState("");const [nxt,setNxt]=useState("");const [rep,setRep]=useState("");
  const [msg,setMsg]=useState(null);const [busy,setBusy]=useState(false);
  const submit=async(e)=>{
    e.preventDefault();
    if(nxt!==rep){setMsg({ok:false,t:"Las nuevas contraseñas no coinciden."});return;}
    if(nxt.length<6){setMsg({ok:false,t:"Mínimo 6 caracteres."});return;}
    setBusy(true);
    const curHash=await sha256(cur);
    if(curHash!==localStorage.getItem(ADM.hash)){setMsg({ok:false,t:"Contraseña actual incorrecta."});setBusy(false);return;}
    localStorage.setItem(ADM.hash,await sha256(nxt));
    setMsg({ok:true,t:"Contraseña cambiada correctamente."});
    setCur("");setNxt("");setRep("");setBusy(false);
  };
  return(
    <form onSubmit={submit} className="adm-pw-form">
      <input type="password" className="adm-input adm-input--sm" placeholder="Contraseña actual" value={cur} onChange={e=>setCur(e.target.value)}/>
      <input type="password" className="adm-input adm-input--sm" placeholder="Nueva contraseña" value={nxt} onChange={e=>setNxt(e.target.value)}/>
      <input type="password" className="adm-input adm-input--sm" placeholder="Repetir nueva" value={rep} onChange={e=>setRep(e.target.value)}/>
      {msg&&<p className={`adm-msg${msg.ok?" adm-msg--ok":" adm-msg--err"}`}>{msg.t}</p>}
      <button type="submit" className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy||!cur||!nxt||!rep}>
        {busy?"Guardando…":"Cambiar contraseña"}
      </button>
    </form>
  );
}

function TabConfig({ cfg, save, onLogout, resetProducts }) {
  const [phone,setPhone]=useState(cfg.wa_phone);
  const [saved,setSaved]=useState(false);
  return(
    <div className="adm-page">
      <div className="adm-cfg-section">
        <h3 className="adm-cfg-h">WhatsApp del negocio</h3>
        <p className="adm-hint">Número con código de país, sin + ni espacios. Ej: 573001234567</p>
        <div className="adm-row-inline">
          <input className="adm-input" value={phone} onChange={e=>setPhone(e.target.value)} style={{maxWidth:260}}/>
          <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={()=>{
            save({wa_phone:phone.replace(/\D/g,"")});setSaved(true);setTimeout(()=>setSaved(false),2000);
          }}>{saved?"Guardado ✓":"Guardar"}</button>
        </div>
      </div>
      <hr className="adm-hr"/>
      <div className="adm-cfg-section">
        <h3 className="adm-cfg-h">Cambiar contraseña</h3>
        <p className="adm-hint">Contraseña por defecto: <code className="adm-code">veta2026</code>. Cámbiala tras el primer acceso.</p>
        <ChangePwForm/>
      </div>
      <hr className="adm-hr"/>
      <div className="adm-cfg-section">
        <h3 className="adm-cfg-h">Datos de productos</h3>
        <p className="adm-hint">Restablece el catálogo al estado inicial (productos de data.js). Los productos personalizados se perderán.</p>
        <button className="adm-btn adm-btn--ghost" onClick={()=>{
          if(window.confirm("¿Restablecer el catálogo a los productos originales? Los cambios en productos se perderán.")) resetProducts();
        }}>Restablecer catálogo original</button>
      </div>
      <hr className="adm-hr"/>
      <div className="adm-cfg-section">
        <h3 className="adm-cfg-h">Sesión</h3>
        <p className="adm-hint">La sesión se cierra automáticamente al cerrar el navegador.</p>
        <button className="adm-btn adm-btn--ghost" onClick={onLogout}>Cerrar sesión</button>
      </div>
      <hr className="adm-hr"/>
      <p className="adm-note">
        <strong>Nota:</strong> Stock, visibilidad, productos y configuración se almacenan en este navegador (localStorage).
        Al migrar a Supabase, estos datos estarán disponibles desde cualquier dispositivo.
      </p>
    </div>
  );
}

// ── Shell con sidebar ─────────────────────────────────────
const ADMIN_TABS = [
  { id:"inicio",    label:"Inicio"    },
  { id:"productos", label:"Productos" },
  { id:"stock",     label:"Stock"     },
  { id:"config",    label:"Config."   },
];

function AdminShell({ onLogout }) {
  const [tab, setTab] = useState("inicio");
  const { products: crudProducts, add, update, remove, resetToSeed } = useProductCRUD();
  const { hidden, toggle } = useHidden();
  const { stock, set: setStock, get: getStock, reset: resetStock } = useStock();
  const { cfg, save: saveCfg } = useCfg();

  const products = crudProducts.map(p => ({ ...p, hidden: hidden.includes(p.id) }));

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar">
        <div className="adm-sb-top">
          <span className="adm-sb-logo">VETA</span>
          <span className="adm-sb-badge">Admin</span>
        </div>
        <nav className="adm-sb-nav">
          {ADMIN_TABS.map(t => (
            <button key={t.id}
              className={`adm-sb-btn${tab===t.id?" adm-sb-btn--on":""}`}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
        <div className="adm-sb-foot">
          <a href="#home" className="adm-sb-link">← Ver tienda</a>
          <button className="adm-sb-link" onClick={onLogout}
            style={{background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left"}}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="adm-body">
        <header className="adm-hdr">
          <h1 className="adm-hdr-title">{ADMIN_TABS.find(t=>t.id===tab)?.label}</h1>
          <span className="adm-hdr-meta">VETA · Panel local</span>
        </header>
        <div className="adm-content">
          {tab==="inicio"    && <TabInicio    products={products} stock={stock}/>}
          {tab==="productos" && <TabProductos products={products}
            addProduct={add} updateProduct={update} removeProduct={remove}
            toggleHidden={toggle}/>}
          {tab==="stock"     && <TabStock     products={products} get={getStock} set={setStock} reset={resetStock}/>}
          {tab==="config"    && <TabConfig    cfg={cfg} save={saveCfg} onLogout={onLogout} resetProducts={resetToSeed}/>}
        </div>
      </div>

      <nav className="adm-mob-tabs">
        {ADMIN_TABS.map(t=>(
          <button key={t.id}
            className={`adm-mob-btn${tab===t.id?" adm-mob-btn--on":""}`}
            onClick={()=>setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
    </div>
  );
}

// ── Raíz ──────────────────────────────────────────────────
function AdminPanel() {
  const { authed, loading, err, login, logout } = useAuth();
  if (!authed) return <AdminLogin onLogin={login} loading={loading} err={err} />;
  return <AdminShell onLogout={logout} />;
}

window.AdminPanel = AdminPanel;
