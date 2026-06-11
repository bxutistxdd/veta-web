/* VETA · Panel de administración
   Backend: Supabase (datos en vivo). Escrituras protegidas por login
   (Supabase Auth) + políticas RLS para el rol authenticated.            */

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ── Avisos (toast) del panel ──────────────────────────────
const _toastSubs = [];
function adminToast(text, isErr = false) {
  _toastSubs.forEach(fn => fn({ text, isErr, id: Date.now() + Math.random() }));
}

// Seed de respaldo si Supabase aún no cargó
function seedProducts() {
  return VETA_DATA.products.map(p => ({ ...p, images: p.images || {} }));
}

// ── API de compatibilidad para el sitio público ───────────
// Antes leía de localStorage; ahora delega en VETA_DB (Supabase).
window.VETA_ADMIN = {
  getProducts() { return window.VETA_DB ? window.VETA_DB.getProducts() : VETA_DATA.products; },
  getStock(pid, sz) { return window.VETA_DB ? window.VETA_DB.getStock(pid, sz) : null; },
  isHidden(pid) { return window.VETA_DB ? window.VETA_DB.isHidden(pid) : false; },
};

// ── Auth (Supabase) ───────────────────────────────────────
function useAuth() {
  const [authed, setAuthed]   = useState(false);
  const [ready, setReady]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");

  useEffect(() => {
    if (!window.VETA_DB) { setReady(true); return; }
    window.VETA_DB.getSession().then(s => { setAuthed(!!s); setReady(true); });
    return window.VETA_DB.onAuthChange(s => setAuthed(!!s));
  }, []);

  const login = useCallback(async (pw) => {
    setLoading(true); setErr("");
    try {
      const { ok, error } = await window.VETA_DB.signIn(pw);
      if (!ok) setErr(/invalid|credential/i.test(error || "") ? "Contraseña incorrecta." : (error || "No se pudo iniciar sesión."));
    } catch { setErr("Error de conexión. Intenta de nuevo."); }
    setLoading(false);
  }, []);

  const logout = useCallback(async () => { try { await window.VETA_DB.signOut(); } catch {} }, []);

  return { authed, ready, loading, err, login, logout };
}

// ── Toaster ───────────────────────────────────────────────
function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (t) => {
      setItems(prev => [...prev, t]);
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== t.id)), 3500);
    };
    _toastSubs.push(fn);
    return () => { const i = _toastSubs.indexOf(fn); if (i >= 0) _toastSubs.splice(i, 1); };
  }, []);
  if (!items.length) return null;
  return (
    <div style={{ position:"fixed", right:16, bottom:16, zIndex:9999, display:"flex", flexDirection:"column", gap:8 }}>
      {items.map(t => (
        <div key={t.id} style={{ padding:"12px 16px", borderRadius:10, maxWidth:320, fontSize:14,
          color:"#fff", background: t.isErr ? "#b3261e" : "#1f7a4d", boxShadow:"0 6px 20px rgba(0,0,0,.25)" }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ── Data hooks (Supabase como fuente de verdad) ───────────
const DEFAULT_WA_PHONE = "573243147031";

function useProducts() {
  const [products, setProducts] = useState(() => (window.VETA_DB && window.VETA_DB.getProducts()) || seedProducts());
  useEffect(() => {
    if (!window.VETA_DB) return;
    return window.VETA_DB.subscribe(() => setProducts((window.VETA_DB.getProducts() || []).slice()));
  }, []);

  const add = useCallback(async (p) => {
    try { await window.VETA_DB.upsertProduct(p); adminToast(`"${p.name}" creado.`); }
    catch (e) { adminToast("No se pudo crear el producto: " + e.message, true); }
  }, []);

  const update = useCallback(async (id, data) => {
    // Conservar visible/featured (el formulario no los toca)
    const current = (window.VETA_DB.getProducts() || []).find(p => p.id === id) || {};
    try { await window.VETA_DB.upsertProduct({ ...current, ...data, id }); adminToast("Cambios guardados."); }
    catch (e) { adminToast("No se pudo guardar: " + e.message, true); }
  }, []);

  const remove = useCallback(async (id) => {
    try { await window.VETA_DB.deleteProduct(id); adminToast("Producto eliminado."); }
    catch (e) { adminToast("No se pudo eliminar: " + e.message, true); }
  }, []);

  const resetToSeed = useCallback(async () => {
    try {
      for (const p of seedProducts()) await window.VETA_DB.upsertProduct({ ...p, visible: true });
      adminToast("Catálogo restablecido.");
    } catch (e) { adminToast("No se pudo restablecer: " + e.message, true); }
  }, []);

  return { products, add, update, remove, resetToSeed };
}

function useStock() {
  const [stock, setStockState] = useState(() => window.VETA_STOCK || {});
  useEffect(() => {
    if (!window.VETA_DB) return;
    return window.VETA_DB.subscribe(() => setStockState({ ...(window.VETA_STOCK || {}) }));
  }, []);

  const set = useCallback(async (pid, sz, qty) => {
    try { await window.VETA_DB.setStock(pid, sz, qty); }
    catch (e) { adminToast("No se pudo guardar el stock: " + e.message, true); }
  }, []);
  const get   = useCallback((pid, sz) => { const v = stock[`${pid}::${sz}`]; return v === undefined ? "" : v; }, [stock]);
  const reset = useCallback(async () => {
    try { await window.VETA_DB.clearStock(); adminToast("Stock limpiado."); }
    catch (e) { adminToast("No se pudo limpiar el stock: " + e.message, true); }
  }, []);
  return { stock, set, get, reset };
}

function useCfg() {
  const read = () => ({
    wa_phone: (window.VETA_DB && window.VETA_DB.getSetting("wa_phone", DEFAULT_WA_PHONE)) || DEFAULT_WA_PHONE,
    bot_daily_limit: parseInt((window.VETA_DB && window.VETA_DB.getSetting("bot_daily_limit", "10")) || "10") || 10,
  });
  const [cfg, setCfg] = useState(read);
  useEffect(() => {
    if (!window.VETA_DB) return;
    return window.VETA_DB.subscribe(() => setCfg(read()));
  }, []);
  const save = useCallback(async (patch) => {
    try {
      for (const [k, v] of Object.entries(patch)) await window.VETA_DB.saveSetting(k, String(v));
      adminToast("Configuración guardada.");
    } catch (e) { adminToast("No se pudo guardar: " + e.message, true); }
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
        <strong>En vivo:</strong> los datos se guardan en Supabase y se reflejan en la tienda al instante, desde cualquier dispositivo.
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
    // Verificar la contraseña actual reautenticando
    const auth=await window.VETA_DB.signIn(cur);
    if(!auth.ok){setMsg({ok:false,t:"Contraseña actual incorrecta."});setBusy(false);return;}
    const res=await window.VETA_DB.changePassword(nxt);
    if(!res.ok){setMsg({ok:false,t:res.error||"No se pudo cambiar la contraseña."});setBusy(false);return;}
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
  const [savedPhone,setSavedPhone]=useState(false);
  const [limit,setLimit]=useState(cfg.bot_daily_limit);
  const [savedLimit,setSavedLimit]=useState(false);
  useEffect(()=>{ setPhone(cfg.wa_phone); }, [cfg.wa_phone]);
  useEffect(()=>{ setLimit(cfg.bot_daily_limit); }, [cfg.bot_daily_limit]);
  return(
    <div className="adm-page">
      <div className="adm-cfg-section">
        <h3 className="adm-cfg-h">WhatsApp del negocio</h3>
        <p className="adm-hint">Número con código de país, sin + ni espacios. Ej: 573001234567</p>
        <div className="adm-row-inline">
          <input className="adm-input" value={phone} onChange={e=>setPhone(e.target.value)} style={{maxWidth:260}}/>
          <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={()=>{
            save({wa_phone:phone.replace(/\D/g,"")});setSavedPhone(true);setTimeout(()=>setSavedPhone(false),2000);
          }}>{savedPhone?"Guardado ✓":"Guardar"}</button>
        </div>
      </div>
      <hr className="adm-hr"/>
      <div className="adm-cfg-section">
        <h3 className="adm-cfg-h">Límite diario del bot IA</h3>
        <p className="adm-hint">Máximo de mensajes que el bot responde por cliente cada día. Al alcanzarlo, avisa que un asesor lo atenderá. Por defecto: 10.</p>
        <div className="adm-row-inline">
          <input className="adm-input" type="number" min="1" max="200" value={limit}
            onChange={e=>setLimit(Math.max(1,parseInt(e.target.value)||1))} style={{maxWidth:100}}/>
          <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={()=>{
            save({bot_daily_limit:String(limit)});setSavedLimit(true);setTimeout(()=>setSavedLimit(false),2000);
          }}>{savedLimit?"Guardado ✓":"Guardar"}</button>
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
        <strong>Nota:</strong> Stock, visibilidad, productos y configuración se guardan en Supabase
        y están disponibles desde cualquier dispositivo en tiempo real.
      </p>
    </div>
  );
}

// ── Tab: Chats (buzón de WhatsApp estilo WhatsApp) ────────
const CHAT_SEEN_KEY = "veta_chat_seen";
function loadSeen() { try { return JSON.parse(localStorage.getItem(CHAT_SEEN_KEY) || "{}"); } catch { return {}; } }
function saveSeen(m) { try { localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(m)); } catch {} }

function chatTime(iso) {
  try { return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}
function chatDayLabel(iso) {
  const d = new Date(iso); const now = new Date();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return "Hoy";
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (sameDay(d, yest)) return "Ayer";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}
function chatListTime(iso) {
  const d = new Date(iso); const now = new Date();
  if (d.toDateString() === now.toDateString()) return chatTime(iso);
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });
}
function chatInitial(name, phone) {
  const s = (name || "").trim();
  if (s) return s[0].toUpperCase();
  return (phone || "?").slice(-2, -1) || "#";
}
function fmtPhone(phone) {
  // 573001234567 → +57 300 123 4567 (aprox., solo presentación)
  if (!phone) return "";
  const p = phone.replace(/\D/g, "");
  if (p.length === 12 && p.startsWith("57")) return `+57 ${p.slice(2,5)} ${p.slice(5,8)} ${p.slice(8)}`;
  return "+" + p;
}
const ROLE_OUT = { assistant: true, agent: true }; // salientes (derecha)

// En móvil (táctil) Enter = salto de línea; se envía solo con el botón.
const CHAT_IS_TOUCH = typeof window !== "undefined" &&
  (("ontouchstart" in window) || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches));

// Inserta un mensaje manteniendo el orden por created_at, para que un mensaje
// que llega por realtime no quede fuera de lugar respecto a su par.
function insertSortedMsg(list, row) {
  if (list.some(m => m.id === row.id)) return list;
  const next = [...list, row];
  next.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return next;
}

// Texto resumido de un mensaje (cita / preview de la lista).
function msgPreview(m) {
  if (!m) return "";
  if (m.msg_type === "image") return "📷 " + (m.content && m.content !== "[imagen]" ? m.content : "Imagen");
  return m.content || "";
}

function useChatBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!window.VETA_DB) return;
    let alive = true;
    const recompute = async () => {
      try {
        await window.VETA_DB.loadThreads();
        const th = window.VETA_DB.getThreads();
        const n = Object.values(th).filter(t => t.needs_human).length;
        if (alive) setCount(n);
      } catch {}
    };
    recompute();
    const unsub = window.VETA_DB.subscribeChats(() => recompute());
    return () => { alive = false; unsub(); };
  }, []);
  return count;
}

function useDespBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!window.VETA_DB) return;
    let alive = true;
    window.VETA_DB.getOrders("pending")
      .then(data => { if (alive) setCount(data.length); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return count;
}

function ChatBubbleRow({ msg, prev, byMid }) {
  const out = ROLE_OUT[msg.role];
  const tag = msg.role === "assistant" ? "IA" : msg.role === "agent" ? "Tú" : null;
  const showDay = !prev || chatDayLabel(prev.created_at) !== chatDayLabel(msg.created_at);
  const quoted = msg.reply_to ? (byMid && byMid[msg.reply_to]) : null;
  const isImg = msg.msg_type === "image" && msg.media_url;
  const caption = isImg && msg.content && msg.content !== "[imagen]" ? msg.content : "";
  return (
    <>
      {showDay && <div className="adm-chat-daysep"><span>{chatDayLabel(msg.created_at)}</span></div>}
      <div className={`adm-chat-msg ${out ? "adm-chat-msg--out" : "adm-chat-msg--in"} adm-chat-msg--${msg.role}`}>
        <div className="adm-chat-bubble">
          {tag && <span className={`adm-chat-tag adm-chat-tag--${msg.role}`}>{tag}</span>}
          {msg.reply_to && (
            <span className={`adm-chat-quote${quoted ? ` adm-chat-quote--${quoted.role}` : ""}`}>
              <span className="adm-chat-quote-text">{quoted ? msgPreview(quoted) : "Mensaje citado"}</span>
            </span>
          )}
          {isImg && (
            <a className="adm-chat-img-wrap" href={msg.media_url} target="_blank" rel="noopener noreferrer">
              <img className="adm-chat-img" src={msg.media_url} alt="Imagen" loading="lazy" />
            </a>
          )}
          {(!isImg || caption) && <span className="adm-chat-text">{isImg ? caption : msg.content}</span>}
          <span className="adm-chat-meta">{chatTime(msg.created_at)}</span>
        </div>
      </div>
    </>
  );
}

function TabChats() {
  const [list, setList]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [active, setActive]     = useState(null);   // phone
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [filter, setFilter]     = useState("todos"); // todos | atencion | pausa
  const [q, setQ]               = useState("");
  const [seen, setSeen]         = useState(loadSeen);
  const [draft, setDraft]       = useState("");
  const [sending, setSending]   = useState(false);
  const [orders, setOrders]     = useState([]);
  const [pendingImg, setPendingImg] = useState(null); // { file, url } imagen a enviar

  const activeRef = useRef(active); activeRef.current = active;
  const endRef = useRef(null);
  const fileRef = useRef(null);

  // Mapa wa_mid -> mensaje, para resolver las citas (reply/quote).
  const byMid = useMemo(() => {
    const m = {};
    messages.forEach(x => { if (x.wa_mid) m[x.wa_mid] = x; });
    return m;
  }, [messages]);

  const reloadList = useCallback(async () => {
    if (!window.VETA_DB) return;
    await window.VETA_DB.loadThreads();
    const l = await window.VETA_DB.getConversationList();
    setList(l); setLoading(false);
  }, []);

  const openThread = useCallback(async (phone) => {
    setActive(phone); setMsgLoading(true); setOrders([]);
    const msgs = await window.VETA_DB.getMessages(phone);
    setMessages(msgs); setMsgLoading(false);
    setSeen(prev => { const n = { ...prev, [phone]: new Date().toISOString() }; saveSeen(n); return n; });
    const th = window.VETA_DB.getThreads()[phone];
    if (th?.needs_human) { try { await window.VETA_DB.clearNeedsHuman(phone); } catch {} }
    try {
      const { data } = await window.VETA_DB.sb.from("wa_orders").select("*").eq("phone", phone).order("created_at", { ascending: false });
      setOrders(data || []);
    } catch { setOrders([]); }
  }, []);

  useEffect(() => {
    reloadList();
    if (!window.VETA_DB) return;
    const unsub = window.VETA_DB.subscribeChats((ev) => {
      if (ev.type === "message" && ev.row && ev.row.phone === activeRef.current) {
        setMessages(prev => insertSortedMsg(prev, ev.row));
        setSeen(prev => { const n = { ...prev, [ev.row.phone]: new Date().toISOString() }; saveSeen(n); return n; });
      }
      reloadList();
    });
    return unsub;
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  const unreadOf = (c) => {
    const s = seen[c.phone];
    return c.last && (!s || new Date(c.last.created_at) > new Date(s)) && c.last.phone !== undefined && c.last.role === "user";
  };

  const filtered = list.filter(c => {
    if (filter === "atencion" && !(c.thread && c.thread.needs_human)) return false;
    if (filter === "pausa" && !(c.thread && c.thread.bot_paused)) return false;
    if (q) {
      const hay = (c.thread?.customer_name || "") + " " + c.phone;
      if (!hay.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const activeThread = (list.find(c => c.phone === active)?.thread) || (active && window.VETA_DB.getThreads()[active]) || null;
  const activeName   = activeThread?.customer_name || "";
  const paused       = !!activeThread?.bot_paused;
  const atencionCount = list.filter(c => c.thread && c.thread.needs_human).length;

  const toggleControl = async () => {
    if (!active) return;
    try {
      await window.VETA_DB.setBotPaused(active, !paused);
      adminToast(!paused ? "Tomaste el control. La IA quedó en pausa para este chat." : "La IA retoma este chat.");
      reloadList();
    } catch (e) { adminToast("No se pudo cambiar: " + e.message, true); }
  };

  const clearPendingImg = () => {
    setPendingImg(prev => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
    if (fileRef.current) fileRef.current.value = "";
  };

  const onPickImage = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type || "")) { adminToast("Selecciona un archivo de imagen.", true); return; }
    if (file.size > 5 * 1024 * 1024) { adminToast("La imagen supera 5 MB.", true); return; }
    setPendingImg(prev => { if (prev?.url) URL.revokeObjectURL(prev.url); return { file, url: URL.createObjectURL(file) }; });
  };

  const send = async () => {
    const text = draft.trim();
    if ((!text && !pendingImg) || !active || sending) return;
    setSending(true);
    try {
      if (pendingImg) {
        const mediaUrl = await window.VETA_DB.uploadChatImage(active, pendingImg.file);
        await window.VETA_DB.sendAgentMessage(active, { text, type: "image", mediaUrl });
      } else {
        await window.VETA_DB.sendAgentMessage(active, text);
      }
      setDraft("");
      clearPendingImg();
      const msgs = await window.VETA_DB.getMessages(active);
      setMessages(msgs);
      reloadList();
    } catch (e) { adminToast(e.message || "No se pudo enviar.", true); }
    setSending(false);
  };

  return (
    <div className={`adm-chat ${active ? "adm-chat--thread-open" : ""}`}>

      {/* ── Lista de conversaciones ── */}
      <aside className="adm-chat-list">
        <div className="adm-chat-list-top">
          <input className="adm-input adm-input--sm" placeholder="Buscar por nombre o número…"
            value={q} onChange={e => setQ(e.target.value)} />
          <div className="adm-chat-filters">
            <button className={`adm-pill${filter==="todos"?" adm-pill--on":""}`} onClick={() => setFilter("todos")}>Todos</button>
            <button className={`adm-pill${filter==="atencion"?" adm-pill--on":""}`} onClick={() => setFilter("atencion")}>
              Requieren atención{atencionCount>0?` · ${atencionCount}`:""}
            </button>
            <button className={`adm-pill${filter==="pausa"?" adm-pill--on":""}`} onClick={() => setFilter("pausa")}>En pausa</button>
          </div>
        </div>
        <div className="adm-chat-list-scroll">
          {loading && <p className="adm-empty">Cargando conversaciones…</p>}
          {!loading && filtered.length === 0 && (
            <p className="adm-empty">{q || filter!=="todos" ? "Sin conversaciones que coincidan." : "Aún no hay conversaciones."}</p>
          )}
          {filtered.map(c => {
            const needs = c.thread && c.thread.needs_human;
            const isPaused = c.thread && c.thread.bot_paused;
            const unread = unreadOf(c);
            return (
              <button key={c.phone}
                className={`adm-chat-item${active===c.phone?" adm-chat-item--on":""}${needs?" adm-chat-item--alert":""}`}
                onClick={() => openThread(c.phone)}>
                <span className="adm-chat-avatar">{chatInitial(c.thread?.customer_name, c.phone)}</span>
                <span className="adm-chat-item-body">
                  <span className="adm-chat-item-top">
                    <span className="adm-chat-item-name">{c.thread?.customer_name || fmtPhone(c.phone)}</span>
                    <span className="adm-chat-item-time">{chatListTime(c.last.created_at)}</span>
                  </span>
                  <span className="adm-chat-item-bottom">
                    <span className="adm-chat-item-prev">
                      {c.last.role === "user" ? "" : c.last.role === "agent" ? "Tú: " : "IA: "}
                      {msgPreview(c.last)}
                    </span>
                    <span className="adm-chat-item-badges">
                      {needs && <span className="adm-chat-dot adm-chat-dot--alert" title="Requiere asesor">!</span>}
                      {isPaused && <span className="adm-chat-pill-mini" title="IA en pausa">⏸</span>}
                      {unread && !needs && <span className="adm-chat-dot" />}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Hilo activo ── */}
      <section className="adm-chat-thread">
        {!active && (
          <div className="adm-chat-empty">
            <div className="adm-chat-empty-logo">VETA</div>
            <p>Selecciona una conversación para ver y responder los mensajes.</p>
            <p className="adm-hint">Las conversaciones llegan en tiempo real desde WhatsApp.</p>
          </div>
        )}
        {active && (
          <>
            <header className="adm-chat-thread-hdr">
              <button className="adm-chat-back" onClick={() => setActive(null)} title="Volver">←</button>
              <span className="adm-chat-avatar">{chatInitial(activeName, active)}</span>
              <div className="adm-chat-thread-id">
                <span className="adm-chat-thread-name">{activeName || fmtPhone(active)}</span>
                <span className="adm-chat-thread-sub">
                  {fmtPhone(active)}
                  {paused ? " · IA en pausa" : " · IA activa"}
                  {orders.length > 0 ? ` · ${orders.length} pedido${orders.length>1?"s":""}` : ""}
                </span>
              </div>
              <button className={`adm-btn adm-btn--sm ${paused ? "adm-btn--primary" : "adm-btn--ghost"}`}
                onClick={toggleControl}>
                {paused ? "Devolver a la IA" : "Tomar control"}
              </button>
            </header>

            {paused && (
              <div className="adm-chat-banner">Estás atendiendo este chat — la IA no responderá hasta que lo devuelvas.</div>
            )}

            <div className="adm-chat-scroll">
              {msgLoading && <p className="adm-empty">Cargando mensajes…</p>}
              {!msgLoading && messages.length === 0 && <p className="adm-empty">Sin mensajes todavía.</p>}
              {messages.map((m, i) => <ChatBubbleRow key={m.id || i} msg={m} prev={messages[i-1]} byMid={byMid} />)}
              <div ref={endRef} />
            </div>

            <div className="adm-chat-composer">
              {pendingImg && (
                <div className="adm-chat-attach">
                  <img src={pendingImg.url} alt="Adjunto" className="adm-chat-attach-thumb" />
                  <button className="adm-chat-attach-x" onClick={clearPendingImg} title="Quitar imagen">×</button>
                </div>
              )}
              <div className="adm-chat-composer-row">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
                <button className="adm-chat-attach-btn" onClick={() => fileRef.current && fileRef.current.click()}
                  disabled={sending} title="Adjuntar imagen">📎</button>
                <textarea className="adm-chat-input" rows={1} placeholder="Escribe un mensaje…"
                  value={draft} onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !CHAT_IS_TOUCH) { e.preventDefault(); send(); } }} />
                <button className="adm-chat-send" onClick={send} disabled={sending || (!draft.trim() && !pendingImg)} title="Enviar">
                  {sending ? "…" : "➤"}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ── Tab: Despachos ────────────────────────────────────────
const DESP_LABELS   = { pending:"Pendiente", dispatched:"Despachado", delivered:"Entregado", problem:"⚠ Problema", cancelled:"Cancelado" };
const DESP_STATUSES = ["pending","dispatched","delivered","problem","cancelled"];

function parseOrderNotes(notes) {
  if (!notes) return { payment:"", address:"" };
  const dirIdx   = notes.search(/dir:/i);
  const payMatch = notes.match(/pago:\s*([^.]+)/i);
  return {
    payment: payMatch ? payMatch[1].trim() : "",
    address: dirIdx >= 0 ? notes.slice(dirIdx + 4).trim() : "",
  };
}

const EyeOpen = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeClosed = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <path d="M10.73 10.73a3 3 0 0 0 4.24 4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

function OrderCard({ order, onStatusChange, onNotesSave, onDeliveryNotesSave, onDelete, onToggleHidden }) {
  const [editingNotes,    setEditingNotes]    = useState(false);
  const [notesVal,        setNotesVal]        = useState(order.admin_notes || "");
  const [savingNotes,     setSavingNotes]     = useState(false);
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [deliveryVal,     setDeliveryVal]     = useState(order.delivery_notes || "");
  const [savingDelivery,  setSavingDelivery]  = useState(false);
  const [statusBusy,      setStatusBusy]      = useState(false);
  const [confirmCancel,   setConfirmCancel]   = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState(false);
  const [actionBusy,      setActionBusy]      = useState(false);

  useEffect(() => { setNotesVal(order.admin_notes || ""); },       [order.admin_notes]);
  useEffect(() => { setDeliveryVal(order.delivery_notes || ""); }, [order.delivery_notes]);

  const { payment: legacyPayment, address: legacyAddress } = parseOrderNotes(order.notes);
  const address   = order.address        || legacyAddress || "";
  const nbhd      = order.neighborhood   || "";
  const aptRef    = order.apt_ref        || "";
  const payment   = order.payment_method || legacyPayment || "";
  const recipient = order.recipient_name || "";
  const NA = "No proporcionó";

  const date = new Date(order.created_at).toLocaleDateString("es-CO",
    { day:"2-digit", month:"short", year:"numeric" });
  const time = new Date(order.created_at).toLocaleTimeString("es-CO",
    { hour:"2-digit", minute:"2-digit", hour12: true });

  const handleStatus = async (e) => {
    const s = e.target.value;
    if (s === order.status || statusBusy) return;
    setStatusBusy(true);
    await onStatusChange(order.id, s);
    setStatusBusy(false);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await onNotesSave(order.id, notesVal);
    setSavingNotes(false);
    setEditingNotes(false);
  };

  const handleSaveDelivery = async () => {
    setSavingDelivery(true);
    await onDeliveryNotesSave(order.id, deliveryVal);
    setSavingDelivery(false);
    setEditingDelivery(false);
  };

  const handleCancel = async () => {
    setActionBusy(true);
    await onStatusChange(order.id, "cancelled");
    setActionBusy(false);
    setConfirmCancel(false);
  };

  const handleDelete = async () => {
    setActionBusy(true);
    await onDelete(order.id);
    setActionBusy(false);
  };

  return (
    <div className={`adm-desp-card adm-desp-card--${order.status}${order.hidden ? " adm-desp-card--hidden" : ""}`}>

      {/* Top: pill + eye + meta */}
      <div className="adm-desp-card-top">
        <span className={`adm-desp-pill adm-desp-pill--${order.status}`}>
          {DESP_LABELS[order.status] || order.status}
        </span>
        <div className="adm-desp-card-top-right">
          <button className={`adm-desp-eye${order.hidden ? " adm-desp-eye--off" : ""}`}
            onClick={() => onToggleHidden(order.id, !order.hidden)}
            title={order.hidden ? "Mostrar pedido" : "Ocultar pedido"}>
            {order.hidden ? <EyeClosed /> : <EyeOpen />}
          </button>
          <div className="adm-desp-meta">
            {order.order_number && <span className="adm-desp-order-num">#{order.order_number}</span>}
            <span className="adm-desp-date">{date}</span>
            <span className="adm-desp-date">{time}</span>
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div className="adm-desp-customer">
        <div className="adm-desp-name">{order.customer_name || "Cliente"}</div>
        <a className="adm-desp-phone"
          href={"https://wa.me/" + order.phone} target="_blank" rel="noopener">
          +{order.phone}
        </a>
      </div>

      {/* Piezas */}
      <div className="adm-desp-items-block">
        <span className="adm-desp-items-lbl">Piezas</span>
        {order.items}
      </div>

      {/* Campos fijos — siempre visibles */}
      <div className="adm-desp-fields">
        <div className="adm-desp-field">
          <span className="adm-desp-lbl">Ciudad</span>
          {order.city
            ? <span>{order.city}{nbhd ? `, ${nbhd}` : ""}</span>
            : <em className="adm-desp-na">{NA}</em>}
        </div>
        <div className="adm-desp-field">
          <span className="adm-desp-lbl">Dirección</span>
          {address ? <span>{address}</span> : <em className="adm-desp-na">{NA}</em>}
        </div>
        <div className="adm-desp-field">
          <span className="adm-desp-lbl">Ref/Entrega</span>
          {aptRef ? <span>{aptRef}</span> : <em className="adm-desp-na">{NA}</em>}
        </div>
        <div className="adm-desp-field">
          <span className="adm-desp-lbl">Pago</span>
          {payment ? <span>{payment}</span> : <em className="adm-desp-na">{NA}</em>}
        </div>
        {recipient && (
          <div className="adm-desp-field adm-desp-field--gift">
            <span className="adm-desp-lbl">Regalo para</span>
            <span>{recipient}</span>
          </div>
        )}
      </div>

      {/* Información adicional de entrega (editable) */}
      <div className="adm-desp-notes-wrap">
        {editingDelivery ? (
          <>
            <textarea className="adm-input adm-desp-notes-ta"
              value={deliveryVal}
              onChange={e => setDeliveryVal(e.target.value)}
              placeholder="Llamar a tal hora, dejar en portería, instrucciones especiales de entrega…"
              rows={2} />
            <div className="adm-desp-notes-actions">
              <button className="adm-btn adm-btn--sm"
                onClick={() => { setDeliveryVal(order.delivery_notes || ""); setEditingDelivery(false); }}>
                Cancelar
              </button>
              <button className="adm-btn adm-btn--primary adm-btn--sm"
                disabled={savingDelivery} onClick={handleSaveDelivery}>
                {savingDelivery ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </>
        ) : (
          <button className="adm-desp-notes-btn adm-desp-notes-btn--info"
            onClick={() => setEditingDelivery(true)}>
            <span className="adm-desp-notes-icon">{order.delivery_notes ? "📦" : "＋"}</span>
            <span>{order.delivery_notes || "Información adicional de entrega"}</span>
          </button>
        )}
      </div>

      {/* Nota de despacho (admin) */}
      <div className="adm-desp-notes-wrap">
        {editingNotes ? (
          <>
            <textarea className="adm-input adm-desp-notes-ta"
              value={notesVal}
              onChange={e => setNotesVal(e.target.value)}
              placeholder="Guía de envío, transportadora, observaciones del admin…"
              rows={2} />
            <div className="adm-desp-notes-actions">
              <button className="adm-btn adm-btn--sm"
                onClick={() => { setNotesVal(order.admin_notes || ""); setEditingNotes(false); }}>
                Cancelar
              </button>
              <button className="adm-btn adm-btn--primary adm-btn--sm"
                disabled={savingNotes} onClick={handleSaveNotes}>
                {savingNotes ? "Guardando…" : "Guardar nota"}
              </button>
            </div>
          </>
        ) : (
          <button className="adm-desp-notes-btn" onClick={() => setEditingNotes(true)}>
            <span className="adm-desp-notes-icon">{order.admin_notes ? "📋" : "＋"}</span>
            <span>{order.admin_notes || "Nota de despacho (admin)"}</span>
          </button>
        )}
      </div>

      {/* Columna de acciones: estado → cancelar → eliminar */}
      <div className="adm-desp-actions-col">
        <select className="adm-desp-status-select" value={order.status}
          disabled={statusBusy} onChange={handleStatus}>
          {DESP_STATUSES.map(s => (
            <option key={s} value={s}>{DESP_LABELS[s]}</option>
          ))}
        </select>

        {!confirmCancel ? (
          <button className="adm-desp-action-btn adm-desp-action-btn--cancel"
            disabled={actionBusy || order.status === "cancelled"}
            onClick={() => setConfirmCancel(true)}>
            Cancelar pedido
          </button>
        ) : (
          <div className="adm-desp-confirm">
            <span className="adm-desp-confirm-q">¿Cancelar este pedido?</span>
            <div className="adm-desp-confirm-btns">
              <button className="adm-btn adm-btn--sm" onClick={() => setConfirmCancel(false)}>No</button>
              <button className="adm-btn adm-btn--danger adm-btn--sm"
                disabled={actionBusy} onClick={handleCancel}>
                {actionBusy ? "…" : "Sí, cancelar"}
              </button>
            </div>
          </div>
        )}

        {!confirmDelete ? (
          <button className="adm-desp-action-btn adm-desp-action-btn--delete"
            disabled={actionBusy}
            onClick={() => setConfirmDelete(true)}>
            Eliminar pedido
          </button>
        ) : (
          <div className="adm-desp-confirm">
            <span className="adm-desp-confirm-q">¿Eliminar definitivamente?</span>
            <div className="adm-desp-confirm-btns">
              <button className="adm-btn adm-btn--sm" onClick={() => setConfirmDelete(false)}>No</button>
              <button className="adm-btn adm-btn--danger adm-btn--sm"
                disabled={actionBusy} onClick={handleDelete}>
                {actionBusy ? "…" : "Eliminar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabDespachos() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("active");
  const [q,       setQ]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await window.VETA_DB.getOrders();
      setOrders(data);
    } catch (e) { adminToast("No se pudieron cargar los despachos: " + e.message, true); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await window.VETA_DB.updateOrderStatus(id, newStatus);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
      adminToast("Estado actualizado.");
    } catch (e) { adminToast("No se pudo actualizar: " + e.message, true); }
  };

  const handleNotesSave = async (id, notes) => {
    try {
      await window.VETA_DB.updateOrderNotes(id, notes);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, admin_notes: notes } : o));
      adminToast("Nota guardada.");
    } catch (e) { adminToast("No se pudo guardar: " + e.message, true); }
  };

  const handleDeliveryNotesSave = async (id, delivery_notes) => {
    try {
      await window.VETA_DB.updateOrderDeliveryNotes(id, delivery_notes);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, delivery_notes } : o));
      adminToast("Nota guardada.");
    } catch (e) { adminToast("No se pudo guardar: " + e.message, true); }
  };

  const handleDelete = async (id) => {
    try {
      await window.VETA_DB.deleteOrder(id);
      setOrders(prev => prev.filter(o => o.id !== id));
      adminToast("Pedido eliminado.");
    } catch (e) { adminToast("No se pudo eliminar: " + e.message, true); }
  };

  const handleToggleHidden = async (id, hidden) => {
    try {
      await window.VETA_DB.toggleOrderHidden(id, hidden);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, hidden } : o));
      adminToast(hidden ? "Pedido ocultado." : "Pedido visible.");
    } catch (e) { adminToast("No se pudo cambiar: " + e.message, true); }
  };

  const counts = useMemo(() => {
    const c = { active:0, pending:0, dispatched:0, delivered:0, problem:0, hidden:0, todos:0 };
    orders.forEach(o => {
      c.todos++;
      if (o.hidden) { c.hidden++; return; }
      if (o.status === "pending")    { c.active++; c.pending++; }
      if (o.status === "dispatched") { c.active++; c.dispatched++; }
      if (o.status === "delivered")  c.delivered++;
      if (o.status === "problem")    c.problem++;
    });
    return c;
  }, [orders]);

  const filtered = useMemo(() => orders.filter(o => {
    if (filter === "todos") { /* mostrar todo */ }
    else if (filter === "hidden") { if (!o.hidden) return false; }
    else {
      if (o.hidden) return false;
      if (filter === "active") {
        if (o.status !== "pending" && o.status !== "dispatched") return false;
      } else {
        if (o.status !== filter) return false;
      }
    }
    if (q) {
      const hay = (o.customer_name || "") + " " + o.phone + " " + (o.city || "");
      if (!hay.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  }), [orders, filter, q]);

  const FILTER_OPTS = [
    ["active",     "Activos"],
    ["pending",    "Pendientes"],
    ["dispatched", "Despachados"],
    ["delivered",  "Entregados"],
    ["problem",    "⚠ Peligro"],
    ["hidden",     "Ocultos"],
    ["todos",      "Todos los pedidos"],
  ];

  return (
    <div className="adm-desp-wrap">
      <div className="adm-desp-toolbar">
        <div className="adm-desp-filters">
          {FILTER_OPTS.map(([id, label]) => (
            <button key={id}
              className={`adm-desp-chip${filter===id?" adm-desp-chip--on":""}${id==="problem"?" adm-desp-chip--warn":""}${id==="hidden"?" adm-desp-chip--muted":""}`}
              onClick={() => setFilter(id)}>
              {label}
              {counts[id] > 0 && <span className="adm-desp-chip-count">{counts[id]}</span>}
            </button>
          ))}
        </div>
        <div className="adm-desp-toolbar-right">
          <input className="adm-input adm-desp-search" placeholder="Buscar…"
            value={q} onChange={e => setQ(e.target.value)} />
          <button className="adm-desp-reload" onClick={load} disabled={loading} title="Actualizar">↺</button>
        </div>
      </div>

      {loading ? (
        <p className="adm-desp-empty">Cargando pedidos…</p>
      ) : filtered.length === 0 ? (
        <p className="adm-desp-empty">
          {filter === "active" ? "No hay pedidos activos." : "No hay pedidos con este estado."}
        </p>
      ) : (
        <div className="adm-desp-list">
          {filtered.map(o => (
            <OrderCard key={o.id} order={o}
              onStatusChange={handleStatusChange}
              onNotesSave={handleNotesSave}
              onDeliveryNotesSave={handleDeliveryNotesSave}
              onDelete={handleDelete}
              onToggleHidden={handleToggleHidden} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shell con sidebar ─────────────────────────────────────
const ADMIN_TABS = [
  { id:"inicio",    label:"Inicio"     },
  { id:"chats",     label:"Chats"      },
  { id:"despachos", label:"Despachos"  },
  { id:"productos", label:"Productos"  },
  { id:"stock",     label:"Stock"      },
  { id:"config",    label:"Config."    },
];

function AdminShell({ onLogout }) {
  const [tab, setTab] = useState("inicio");
  const { products: rawProducts, add, update, remove, resetToSeed } = useProducts();
  const { stock, set: setStock, get: getStock, reset: resetStock } = useStock();
  const { cfg, save: saveCfg } = useCfg();
  const chatBadge = useChatBadge();
  const despBadge = useDespBadge();

  const toggleHidden = useCallback(async (id) => {
    const p = (window.VETA_DB.getProducts() || []).find(x => x.id === id);
    const currentlyVisible = p ? p.visible !== false : true;
    try { await window.VETA_DB.setVisible(id, !currentlyVisible); }
    catch (e) { adminToast("No se pudo cambiar la visibilidad: " + e.message, true); }
  }, []);

  const products = rawProducts.map(p => ({ ...p, hidden: p.visible === false }));

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
              onClick={() => setTab(t.id)}>
              {t.label}
              {t.id==="chats"     && chatBadge>0 && <span className="adm-sb-badge-count">{chatBadge}</span>}
              {t.id==="despachos" && despBadge>0 && <span className="adm-sb-badge-count">{despBadge}</span>}
            </button>
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

      <div className={`adm-body${tab==="chats"?" adm-body--chat":""}`}>
        <header className="adm-hdr">
          <h1 className="adm-hdr-title">{ADMIN_TABS.find(t=>t.id===tab)?.label}</h1>
          <span className="adm-hdr-meta">VETA · Panel en la nube</span>
        </header>
        <div className="adm-content">
          {tab==="inicio"    && <TabInicio    products={products} stock={stock}/>}
          {tab==="chats"     && <TabChats />}
          {tab==="despachos" && <TabDespachos />}
          {tab==="productos" && <TabProductos products={products}
            addProduct={add} updateProduct={update} removeProduct={remove}
            toggleHidden={toggleHidden}/>}
          {tab==="stock"     && <TabStock     products={products} get={getStock} set={setStock} reset={resetStock}/>}
          {tab==="config"    && <TabConfig    cfg={cfg} save={saveCfg} onLogout={onLogout} resetProducts={resetToSeed}/>}
        </div>
      </div>

      <nav className="adm-mob-tabs">
        {ADMIN_TABS.map(t=>(
          <button key={t.id}
            className={`adm-mob-btn${tab===t.id?" adm-mob-btn--on":""}`}
            onClick={()=>setTab(t.id)}>
            {t.label}
            {t.id==="chats"     && chatBadge>0 && <span className="adm-mob-badge">{chatBadge}</span>}
            {t.id==="despachos" && despBadge>0 && <span className="adm-mob-badge">{despBadge}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Raíz ──────────────────────────────────────────────────
function AdminPanel() {
  const { authed, ready, loading, err, login, logout } = useAuth();
  return (
    <>
      {!ready
        ? <div className="adm-login-wrap"><div className="adm-login-card">
            <div className="adm-login-logo">VETA</div>
            <p className="adm-login-sub">Cargando…</p>
          </div></div>
        : (authed ? <AdminShell onLogout={logout} /> : <AdminLogin onLogin={login} loading={loading} err={err} />)}
      <Toaster/>
    </>
  );
}

window.AdminPanel = AdminPanel;
