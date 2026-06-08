/* VETA · Panel de administración
   Backend: Supabase (datos en vivo). Escrituras protegidas por login
   (Supabase Auth) + políticas RLS para el rol authenticated.            */

var {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo
} = React;

// ── Avisos (toast) del panel ──────────────────────────────
var _toastSubs = [];
function adminToast(text, isErr = false) {
  _toastSubs.forEach(fn => fn({
    text,
    isErr,
    id: Date.now() + Math.random()
  }));
}

// Seed de respaldo si Supabase aún no cargó
function seedProducts() {
  return VETA_DATA.products.map(p => ({
    ...p,
    images: p.images || {}
  }));
}

// ── API de compatibilidad para el sitio público ───────────
// Antes leía de localStorage; ahora delega en VETA_DB (Supabase).
window.VETA_ADMIN = {
  getProducts() {
    return window.VETA_DB ? window.VETA_DB.getProducts() : VETA_DATA.products;
  },
  getStock(pid, sz) {
    return window.VETA_DB ? window.VETA_DB.getStock(pid, sz) : null;
  },
  isHidden(pid) {
    return window.VETA_DB ? window.VETA_DB.isHidden(pid) : false;
  }
};

// ── Auth (Supabase) ───────────────────────────────────────
function useAuth() {
  var [authed, setAuthed] = useState(false);
  var [ready, setReady] = useState(false);
  var [loading, setLoading] = useState(false);
  var [err, setErr] = useState("");
  useEffect(() => {
    if (!window.VETA_DB) {
      setReady(true);
      return;
    }
    window.VETA_DB.getSession().then(s => {
      setAuthed(!!s);
      setReady(true);
    });
    return window.VETA_DB.onAuthChange(s => setAuthed(!!s));
  }, []);
  var login = useCallback(async pw => {
    setLoading(true);
    setErr("");
    try {
      var {
        ok,
        error
      } = await window.VETA_DB.signIn(pw);
      if (!ok) setErr(/invalid|credential/i.test(error || "") ? "Contraseña incorrecta." : error || "No se pudo iniciar sesión.");
    } catch {
      setErr("Error de conexión. Intenta de nuevo.");
    }
    setLoading(false);
  }, []);
  var logout = useCallback(async () => {
    try {
      await window.VETA_DB.signOut();
    } catch {}
  }, []);
  return {
    authed,
    ready,
    loading,
    err,
    login,
    logout
  };
}

// ── Toaster ───────────────────────────────────────────────
function Toaster() {
  var [items, setItems] = useState([]);
  useEffect(() => {
    var fn = t => {
      setItems(prev => [...prev, t]);
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== t.id)), 3500);
    };
    _toastSubs.push(fn);
    return () => {
      var i = _toastSubs.indexOf(fn);
      if (i >= 0) _toastSubs.splice(i, 1);
    };
  }, []);
  if (!items.length) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      right: 16,
      bottom: 16,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, items.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      padding: "12px 16px",
      borderRadius: 10,
      maxWidth: 320,
      fontSize: 14,
      color: "#fff",
      background: t.isErr ? "#b3261e" : "#1f7a4d",
      boxShadow: "0 6px 20px rgba(0,0,0,.25)"
    }
  }, t.text)));
}

// ── Data hooks (Supabase como fuente de verdad) ───────────
var DEFAULT_WA_PHONE = "573243147031";
function useProducts() {
  var [products, setProducts] = useState(() => window.VETA_DB && window.VETA_DB.getProducts() || seedProducts());
  useEffect(() => {
    if (!window.VETA_DB) return;
    return window.VETA_DB.subscribe(() => setProducts((window.VETA_DB.getProducts() || []).slice()));
  }, []);
  var add = useCallback(async p => {
    try {
      await window.VETA_DB.upsertProduct(p);
      adminToast(`"${p.name}" creado.`);
    } catch (e) {
      adminToast("No se pudo crear el producto: " + e.message, true);
    }
  }, []);
  var update = useCallback(async (id, data) => {
    // Conservar visible/featured (el formulario no los toca)
    var current = (window.VETA_DB.getProducts() || []).find(p => p.id === id) || {};
    try {
      await window.VETA_DB.upsertProduct({
        ...current,
        ...data,
        id
      });
      adminToast("Cambios guardados.");
    } catch (e) {
      adminToast("No se pudo guardar: " + e.message, true);
    }
  }, []);
  var remove = useCallback(async id => {
    try {
      await window.VETA_DB.deleteProduct(id);
      adminToast("Producto eliminado.");
    } catch (e) {
      adminToast("No se pudo eliminar: " + e.message, true);
    }
  }, []);
  var resetToSeed = useCallback(async () => {
    try {
      for (var p of seedProducts()) await window.VETA_DB.upsertProduct({
        ...p,
        visible: true
      });
      adminToast("Catálogo restablecido.");
    } catch (e) {
      adminToast("No se pudo restablecer: " + e.message, true);
    }
  }, []);
  return {
    products,
    add,
    update,
    remove,
    resetToSeed
  };
}
function useStock() {
  var [stock, setStockState] = useState(() => window.VETA_STOCK || {});
  useEffect(() => {
    if (!window.VETA_DB) return;
    return window.VETA_DB.subscribe(() => setStockState({
      ...(window.VETA_STOCK || {})
    }));
  }, []);
  var set = useCallback(async (pid, sz, qty) => {
    try {
      await window.VETA_DB.setStock(pid, sz, qty);
    } catch (e) {
      adminToast("No se pudo guardar el stock: " + e.message, true);
    }
  }, []);
  var get = useCallback((pid, sz) => {
    var v = stock[`${pid}::${sz}`];
    return v === undefined ? "" : v;
  }, [stock]);
  var reset = useCallback(async () => {
    try {
      await window.VETA_DB.clearStock();
      adminToast("Stock limpiado.");
    } catch (e) {
      adminToast("No se pudo limpiar el stock: " + e.message, true);
    }
  }, []);
  return {
    stock,
    set,
    get,
    reset
  };
}
function useCfg() {
  var read = () => ({
    wa_phone: window.VETA_DB && window.VETA_DB.getSetting("wa_phone", DEFAULT_WA_PHONE) || DEFAULT_WA_PHONE,
    bot_daily_limit: parseInt(window.VETA_DB && window.VETA_DB.getSetting("bot_daily_limit", "10") || "10") || 10
  });
  var [cfg, setCfg] = useState(read);
  useEffect(() => {
    if (!window.VETA_DB) return;
    return window.VETA_DB.subscribe(() => setCfg(read()));
  }, []);
  var save = useCallback(async patch => {
    try {
      for (var [k, v] of Object.entries(patch)) await window.VETA_DB.saveSetting(k, String(v));
      adminToast("Configuración guardada.");
    } catch (e) {
      adminToast("No se pudo guardar: " + e.message, true);
    }
  }, []);
  return {
    cfg,
    save
  };
}

// ── Login ─────────────────────────────────────────────────
function AdminLogin({
  onLogin,
  loading,
  err
}) {
  var [pw, setPw] = useState("");
  var ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  return /*#__PURE__*/React.createElement("div", {
    className: "adm-login-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-login-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-login-logo"
  }, "VETA"), /*#__PURE__*/React.createElement("p", {
    className: "adm-login-sub"
  }, "Panel de administraci\xF3n"), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      pw && onLogin(pw);
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl",
    htmlFor: "adm-pw"
  }, "Contrase\xF1a"), /*#__PURE__*/React.createElement("input", {
    id: "adm-pw",
    ref: ref,
    type: "password",
    className: "adm-input",
    value: pw,
    onChange: e => setPw(e.target.value),
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    autoComplete: "current-password"
  }), err && /*#__PURE__*/React.createElement("p", {
    className: "adm-msg adm-msg--err"
  }, err), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "adm-btn adm-btn--primary",
    disabled: loading || !pw
  }, loading ? "Verificando…" : "Entrar")), /*#__PURE__*/React.createElement("a", {
    href: "#home",
    className: "adm-back-link"
  }, "\u2190 Volver al sitio")));
}

// ── Tab: Inicio ───────────────────────────────────────────
function TabInicio({
  products,
  stock
}) {
  var total = products.length;
  var visible = products.filter(p => !p.hidden).length;
  var ocultos = total - visible;
  var stEntries = Object.entries(stock);
  var agotados = stEntries.filter(([, v]) => v === 0).length;
  var bajos = stEntries.filter(([, v]) => v > 0 && v <= 2).length;
  var bycat = {};
  products.forEach(p => {
    bycat[p.cat] = (bycat[p.cat] || 0) + 1;
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "adm-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-stats-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-stat-n"
  }, total), /*#__PURE__*/React.createElement("span", {
    className: "adm-stat-l"
  }, "Total productos")), /*#__PURE__*/React.createElement("div", {
    className: "adm-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-stat-n"
  }, visible), /*#__PURE__*/React.createElement("span", {
    className: "adm-stat-l"
  }, "Visibles en tienda")), /*#__PURE__*/React.createElement("div", {
    className: "adm-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-stat-n"
  }, ocultos), /*#__PURE__*/React.createElement("span", {
    className: "adm-stat-l"
  }, "Ocultos")), /*#__PURE__*/React.createElement("div", {
    className: `adm-stat${agotados > 0 ? " adm-stat--warn" : ""}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-stat-n"
  }, agotados), /*#__PURE__*/React.createElement("span", {
    className: "adm-stat-l"
  }, "Agotados (0 und.)")), /*#__PURE__*/React.createElement("div", {
    className: `adm-stat${bajos > 0 ? " adm-stat--warn" : ""}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-stat-n"
  }, bajos), /*#__PURE__*/React.createElement("span", {
    className: "adm-stat-l"
  }, "Stock bajo (\u22642 und.)"))), /*#__PURE__*/React.createElement("h3", {
    className: "adm-sub-h"
  }, "Por categor\xEDa"), /*#__PURE__*/React.createElement("div", {
    className: "adm-card"
  }, /*#__PURE__*/React.createElement("table", {
    className: "adm-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Categor\xEDa"), /*#__PURE__*/React.createElement("th", null, "Productos"))), /*#__PURE__*/React.createElement("tbody", null, Object.entries(bycat).map(([cat, n]) => /*#__PURE__*/React.createElement("tr", {
    key: cat
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      textTransform: "capitalize"
    }
  }, cat), /*#__PURE__*/React.createElement("td", null, n)))))), agotados > 0 && /*#__PURE__*/React.createElement("div", {
    className: "adm-alert"
  }, "\u26A0 ", agotados, " talla(s) con stock en cero. Revisa la pesta\xF1a ", /*#__PURE__*/React.createElement("strong", null, "Stock"), "."), /*#__PURE__*/React.createElement("p", {
    className: "adm-note"
  }, /*#__PURE__*/React.createElement("strong", null, "En vivo:"), " los datos se guardan en Supabase y se reflejan en la tienda al instante, desde cualquier dispositivo."));
}

// ── Preview de imagen ──────────────────────────────────────
function ImgPreview({
  url
}) {
  var [status, setStatus] = useState("empty");
  useEffect(() => {
    setStatus(url ? "loading" : "empty");
  }, [url]);
  return /*#__PURE__*/React.createElement("div", {
    className: "adm-img-prev"
  }, !url && /*#__PURE__*/React.createElement("span", {
    className: "adm-img-prev__txt"
  }, "Sin imagen"), url && status !== "ok" && !url.startsWith("data:") && /*#__PURE__*/React.createElement("span", {
    className: "adm-img-prev__txt"
  }, status === "error" ? "URL inválida" : "…"), url && /*#__PURE__*/React.createElement("img", {
    key: url,
    src: url,
    alt: "",
    style: {
      display: status === "ok" ? "block" : "none"
    },
    onLoad: () => setStatus("ok"),
    onError: () => setStatus("error")
  }));
}

// ── Formulario de producto (crear / editar) ────────────────
var IMG_VIEWS = [{
  key: "main",
  label: "Principal",
  hint: "Imagen principal — aparece en el catálogo y como vista 1 en PDP"
}, {
  key: "profile",
  label: "Perfil (vista 2)",
  hint: "Vista de perfil o ángulo lateral"
}, {
  key: "detail",
  label: "Detalle de acabado (vista 3)",
  hint: "Macro del acabado o textura"
}, {
  key: "context",
  label: "En uso / contexto (vista 4)",
  hint: "Foto de la pieza siendo usada"
}];
function ProductForm({
  product,
  allProducts,
  onSave,
  onBack
}) {
  var isNew = !product;
  var initForm = useCallback(p => ({
    name: p?.name || "",
    cat: p?.cat || VETA_DATA.categories[0].id,
    material: p?.material || VETA_DATA.materials[0],
    matMode: p?.material && !VETA_DATA.materials.includes(p.material) ? "custom" : "preset",
    finish: p?.finish || VETA_DATA.finishes[0],
    finMode: p?.finish && !VETA_DATA.finishes.includes(p.finish) ? "custom" : "preset",
    price: p?.price || "",
    sizesStr: (p?.sizes || []).join(", "),
    blurb: p?.blurb || "",
    desc: p?.desc || "",
    imgMain: p?.images?.main || "",
    imgProfile: p?.images?.profile || "",
    imgDetail: p?.images?.detail || "",
    imgContext: p?.images?.context || ""
  }), []);
  var [form, setFormRaw] = useState(() => initForm(product));
  var [id, setId] = useState(product?.id || "");
  var [errors, setErrors] = useState({});
  var set = useCallback((k, v) => setFormRaw(f => ({
    ...f,
    [k]: v
  })), []);

  // Auto-generar ID cuando cambia la categoría (solo productos nuevos)
  useEffect(() => {
    if (!isNew) return;
    var pfx = {
      anillos: "an",
      collares: "co",
      aretes: "ar",
      pulseras: "pu",
      piercings: "pi"
    }[form.cat] || "prod";
    var nums = allProducts.filter(p => p.id.startsWith(pfx + "-")).map(p => {
      var n = parseInt(p.id.split("-")[1], 10);
      return isNaN(n) ? 0 : n;
    });
    var next = nums.length ? Math.max(...nums) + 1 : 1;
    setId(`${pfx}-${String(next).padStart(2, "0")}`);
  }, [form.cat, isNew]);
  var validate = () => {
    var e = {};
    if (!form.name.trim()) e.name = "El nombre es obligatorio.";
    if (!form.price || Number(form.price) <= 0) e.price = "El precio debe ser mayor a 0.";
    if (!form.sizesStr.trim()) e.sizes = "Agrega al menos una talla.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  var handleSubmit = e => {
    e.preventDefault();
    if (!validate()) return;
    var sizes = form.sizesStr.split(",").map(s => s.trim()).filter(Boolean);
    onSave({
      id,
      name: form.name.trim(),
      cat: form.cat,
      material: form.material,
      finish: form.finish,
      price: parseInt(form.price, 10),
      sizes,
      blurb: form.blurb.trim(),
      desc: form.desc.trim(),
      images: {
        main: form.imgMain.trim(),
        profile: form.imgProfile.trim(),
        detail: form.imgDetail.trim(),
        context: form.imgContext.trim()
      }
    });
  };
  var sizeChips = form.sizesStr.split(",").map(s => s.trim()).filter(Boolean);
  var imgKeys = ["imgMain", "imgProfile", "imgDetail", "imgContext"];
  return /*#__PURE__*/React.createElement("div", {
    className: "adm-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-form-topbar"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "adm-back-btn",
    onClick: onBack
  }, "\u2190 Volver"), /*#__PURE__*/React.createElement("h2", {
    className: "adm-form-title"
  }, isNew ? "Nuevo producto" : `Editar · ${product.name}`)), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    className: "adm-product-form"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-form-card"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "adm-form-card-h"
  }, "Informaci\xF3n b\xE1sica"), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field adm-form-field--full"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Nombre ", /*#__PURE__*/React.createElement("span", {
    className: "adm-required"
  }, "*")), /*#__PURE__*/React.createElement("input", {
    className: `adm-input${errors.name ? " adm-input--err" : ""}`,
    value: form.name,
    onChange: e => set("name", e.target.value),
    placeholder: "Ej: Anillo Vena"
  }), errors.name && /*#__PURE__*/React.createElement("span", {
    className: "adm-field-err"
  }, errors.name)), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "ID del producto"), /*#__PURE__*/React.createElement("input", {
    className: "adm-input adm-input--mono",
    value: id,
    readOnly: true,
    style: {
      color: "var(--ink-faint)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "adm-field-hint"
  }, "Generado autom\xE1ticamente")), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Categor\xEDa"), /*#__PURE__*/React.createElement("select", {
    className: "adm-input",
    value: form.cat,
    onChange: e => set("cat", e.target.value)
  }, VETA_DATA.categories.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.label)))), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Material"), /*#__PURE__*/React.createElement("select", {
    className: "adm-input",
    value: form.matMode === "custom" ? "__custom__" : form.material,
    onChange: e => {
      if (e.target.value === "__custom__") {
        set("matMode", "custom");
        set("material", "");
      } else {
        set("matMode", "preset");
        set("material", e.target.value);
      }
    }
  }, VETA_DATA.materials.map(m => /*#__PURE__*/React.createElement("option", {
    key: m,
    value: m
  }, m)), /*#__PURE__*/React.createElement("option", {
    value: "__custom__"
  }, "Otro\u2026")), form.matMode === "custom" && /*#__PURE__*/React.createElement("input", {
    className: "adm-input adm-input--sm",
    style: {
      marginTop: 6
    },
    placeholder: "Ej: Titanio, Cobre, \u2026",
    value: form.material,
    onChange: e => set("material", e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Acabado"), /*#__PURE__*/React.createElement("select", {
    className: "adm-input",
    value: form.finMode === "custom" ? "__custom__" : form.finish,
    onChange: e => {
      if (e.target.value === "__custom__") {
        set("finMode", "custom");
        set("finish", "");
      } else {
        set("finMode", "preset");
        set("finish", e.target.value);
      }
    }
  }, VETA_DATA.finishes.map(f => /*#__PURE__*/React.createElement("option", {
    key: f,
    value: f
  }, f)), /*#__PURE__*/React.createElement("option", {
    value: "__custom__"
  }, "Otro\u2026")), form.finMode === "custom" && /*#__PURE__*/React.createElement("input", {
    className: "adm-input adm-input--sm",
    style: {
      marginTop: 6
    },
    placeholder: "Ej: Envejecido, Oxidado, \u2026",
    value: form.finish,
    onChange: e => set("finish", e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Precio ", /*#__PURE__*/React.createElement("span", {
    className: "adm-required"
  }, "*")), /*#__PURE__*/React.createElement("div", {
    className: "adm-price-row"
  }, /*#__PURE__*/React.createElement("input", {
    className: `adm-input${errors.price ? " adm-input--err" : ""}`,
    type: "number",
    min: "0",
    step: "1000",
    value: form.price,
    onChange: e => set("price", e.target.value),
    placeholder: "180000"
  }), /*#__PURE__*/React.createElement("span", {
    className: "adm-price-cur"
  }, "COP")), Number(form.price) > 0 && /*#__PURE__*/React.createElement("span", {
    className: "adm-field-hint"
  }, VETA_DATA.fmtPrice(Number(form.price)), " COP"), errors.price && /*#__PURE__*/React.createElement("span", {
    className: "adm-field-err"
  }, errors.price)))), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-card"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "adm-form-card-h"
  }, "Contenido"), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Tagline ", /*#__PURE__*/React.createElement("span", {
    className: "adm-field-hint-inline"
  }, "\u2014 frase corta (1-2 l\xEDneas)")), /*#__PURE__*/React.createElement("input", {
    className: "adm-input",
    value: form.blurb,
    onChange: e => set("blurb", e.target.value),
    placeholder: "Ej: Una l\xEDnea sobre la piel, fina y precisa."
  })), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Descripci\xF3n completa"), /*#__PURE__*/React.createElement("textarea", {
    className: "adm-input adm-textarea",
    rows: 4,
    value: form.desc,
    onChange: e => set("desc", e.target.value),
    placeholder: "Descripci\xF3n detallada: materiales, proceso, detalles de fabricaci\xF3n\u2026"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-card"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "adm-form-card-h"
  }, "Tallas / Largos"), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Tallas disponibles ", /*#__PURE__*/React.createElement("span", {
    className: "adm-required"
  }, "*")), /*#__PURE__*/React.createElement("input", {
    className: `adm-input${errors.sizes ? " adm-input--err" : ""}`,
    value: form.sizesStr,
    onChange: e => set("sizesStr", e.target.value),
    placeholder: "5, 6, 7, 8, 9  \u2014  40cm, 45cm, 50cm  \u2014  S, M, L  \u2014  \xFAnico"
  }), /*#__PURE__*/React.createElement("span", {
    className: "adm-field-hint"
  }, "Separar por comas"), errors.sizes && /*#__PURE__*/React.createElement("span", {
    className: "adm-field-err"
  }, errors.sizes)), sizeChips.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "adm-size-preview"
  }, sizeChips.map((s, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "adm-size-chip-prev"
  }, s)))), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-card"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "adm-form-card-h"
  }, "Im\xE1genes"), /*#__PURE__*/React.createElement("p", {
    className: "adm-hint",
    style: {
      marginBottom: 14
    }
  }, "Sube las fotos a ", /*#__PURE__*/React.createElement("strong", null, "Cloudinary"), " (gratis en ", /*#__PURE__*/React.createElement("code", {
    className: "adm-code"
  }, "cloudinary.com"), ") y pega aqu\xED el URL directo de cada imagen. Si no hay imagen, se muestra el placeholder SVG."), /*#__PURE__*/React.createElement("div", {
    className: "adm-img-fields"
  }, IMG_VIEWS.map(({
    key,
    label,
    hint
  }, i) => /*#__PURE__*/React.createElement("div", {
    key: key,
    className: "adm-img-field-row"
  }, /*#__PURE__*/React.createElement(ImgPreview, {
    url: form[imgKeys[i]]
  }), /*#__PURE__*/React.createElement("div", {
    className: "adm-img-field-inputs"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "adm-field-hint",
    style: {
      marginBottom: 4
    }
  }, hint), /*#__PURE__*/React.createElement("input", {
    className: "adm-input adm-input--sm",
    type: "url",
    value: form[imgKeys[i]],
    onChange: e => set(imgKeys[i], e.target.value),
    placeholder: "https://res.cloudinary.com/tu-cuenta/\u2026"
  })))))), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-actions"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "adm-btn adm-btn--ghost",
    onClick: onBack
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "adm-btn adm-btn--primary"
  }, isNew ? "Crear producto" : "Guardar cambios"))));
}

// ── Tab: Productos (CRUD) ─────────────────────────────────
function TabProductos({
  products,
  addProduct,
  updateProduct,
  removeProduct,
  toggleHidden
}) {
  var [view, setView] = useState("list"); // "list" | "new" | <product-obj>
  var [q, setQ] = useState("");
  var [cat, setCat] = useState("todas");
  var cats = ["todas", ...VETA_DATA.categories.map(c => c.id)];
  var filtered = products.filter(p => {
    var mq = !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.id.includes(q);
    var mc = cat === "todas" || p.cat === cat;
    return mq && mc;
  });
  var handleDelete = p => {
    if (window.confirm(`¿Eliminar "${p.name}"? No se puede deshacer.`)) removeProduct(p.id);
  };

  // Mostrar formulario
  if (view === "new" || view && typeof view === "object") {
    return /*#__PURE__*/React.createElement(ProductForm, {
      product: typeof view === "object" ? view : null,
      allProducts: products,
      onSave: data => {
        if (typeof view === "object") updateProduct(data.id, data);else addProduct(data);
        setView("list");
      },
      onBack: () => setView("list")
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "adm-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-toolbar"
  }, /*#__PURE__*/React.createElement("input", {
    className: "adm-input adm-input--sm",
    placeholder: "Buscar producto\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "adm-pills"
  }, cats.map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    className: `adm-pill${cat === c ? " adm-pill--on" : ""}`,
    onClick: () => setCat(c),
    style: {
      textTransform: "capitalize"
    }
  }, c))), /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--primary adm-btn--sm",
    style: {
      marginLeft: "auto"
    },
    onClick: () => setView("new")
  }, "+ Nuevo producto")), /*#__PURE__*/React.createElement("div", {
    className: "adm-table-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "adm-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Img."), /*#__PURE__*/React.createElement("th", null, "Nombre"), /*#__PURE__*/React.createElement("th", null, "Cat."), /*#__PURE__*/React.createElement("th", null, "Material"), /*#__PURE__*/React.createElement("th", null, "Precio"), /*#__PURE__*/React.createElement("th", null, "Tallas"), /*#__PURE__*/React.createElement("th", null, "Estado"), /*#__PURE__*/React.createElement("th", null, "Acciones"))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.id,
    className: p.hidden ? "adm-row--dim" : ""
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "adm-prod-thumb"
  }, p.images?.main ? /*#__PURE__*/React.createElement("img", {
    src: p.images.main,
    alt: p.name
  }) : /*#__PURE__*/React.createElement(PHShape, {
    kind: VETA_DATA.shapes[p.cat]?.kind || "ring"
  }))), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 500
    }
  }, p.name), /*#__PURE__*/React.createElement("code", {
    className: "adm-code"
  }, p.id)), /*#__PURE__*/React.createElement("td", {
    style: {
      textTransform: "capitalize",
      color: "var(--ink-soft)"
    }
  }, p.cat), /*#__PURE__*/React.createElement("td", {
    style: {
      color: "var(--ink-soft)"
    }
  }, p.material), /*#__PURE__*/React.createElement("td", null, VETA_DATA.fmtPrice(p.price)), /*#__PURE__*/React.createElement("td", {
    className: "adm-sizes-cell"
  }, p.sizes.join(" · ")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
    className: `adm-badge${p.hidden ? "" : " adm-badge--on"}`,
    onClick: () => toggleHidden(p.id)
  }, p.hidden ? "Oculto" : "Visible")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "adm-row-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "adm-action-btn",
    onClick: () => setView(p),
    title: "Editar"
  }, "\u270F"), /*#__PURE__*/React.createElement("button", {
    className: "adm-action-btn adm-action-btn--del",
    onClick: () => handleDelete(p),
    title: "Eliminar"
  }, "\u2715"))))))), filtered.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "adm-empty"
  }, q ? `Sin resultados para "${q}".` : "No hay productos. ¡Agrega el primero!")));
}

// ── Tab: Stock ────────────────────────────────────────────
function StockCell({
  pid,
  sz,
  get,
  set
}) {
  var val = get(pid, sz);
  var [edit, setEdit] = useState(false);
  var [local, setLocal] = useState("");
  var cls = val === "" ? "adm-sc--nd" : val === 0 ? "adm-sc--zero" : val <= 2 ? "adm-sc--low" : "adm-sc--ok";
  var commit = () => {
    var s = local.trim();
    if (s === "") set(pid, sz, -1);else {
      var n = parseInt(s, 10);
      if (!isNaN(n) && n >= 0) set(pid, sz, n);
    }
    setEdit(false);
  };
  if (edit) return /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    className: "adm-sc-inp",
    value: local,
    onChange: e => setLocal(e.target.value),
    onBlur: commit,
    onKeyDown: e => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") setEdit(false);
    },
    autoFocus: true
  });
  return /*#__PURE__*/React.createElement("button", {
    className: `adm-sc ${cls}`,
    title: "Clic para editar",
    onClick: () => {
      setLocal(val === "" ? "" : String(val));
      setEdit(true);
    }
  }, val === "" ? "—" : val);
}
function TabStock({
  products,
  get,
  set,
  reset
}) {
  var [cat, setCat] = useState("todas");
  var cats = ["todas", ...VETA_DATA.categories.map(c => c.id)];
  var filtered = cat === "todas" ? products : products.filter(p => p.cat === cat);
  return /*#__PURE__*/React.createElement("div", {
    className: "adm-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-toolbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-pills"
  }, cats.map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    className: `adm-pill${cat === c ? " adm-pill--on" : ""}`,
    onClick: () => setCat(c),
    style: {
      textTransform: "capitalize"
    }
  }, c))), /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--ghost adm-btn--sm",
    onClick: () => window.confirm("¿Limpiar todo el stock definido?") && reset()
  }, "Limpiar todo")), /*#__PURE__*/React.createElement("p", {
    className: "adm-legend-row"
  }, /*#__PURE__*/React.createElement("span", null, "Leyenda:"), /*#__PURE__*/React.createElement("span", {
    className: "adm-sc adm-sc--ok",
    style: {
      pointerEvents: "none"
    }
  }, "4+"), /*#__PURE__*/React.createElement("span", null, "Disponible"), /*#__PURE__*/React.createElement("span", {
    className: "adm-sc adm-sc--low",
    style: {
      pointerEvents: "none"
    }
  }, "\u22642"), /*#__PURE__*/React.createElement("span", null, "Stock bajo"), /*#__PURE__*/React.createElement("span", {
    className: "adm-sc adm-sc--zero",
    style: {
      pointerEvents: "none"
    }
  }, "0"), /*#__PURE__*/React.createElement("span", null, "Agotado"), /*#__PURE__*/React.createElement("span", {
    className: "adm-sc adm-sc--nd",
    style: {
      pointerEvents: "none"
    }
  }, "\u2014"), /*#__PURE__*/React.createElement("span", null, "Sin definir")), /*#__PURE__*/React.createElement("div", {
    className: "adm-stock-list"
  }, filtered.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    className: "adm-stock-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-stock-prod"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-stock-name"
  }, p.name), /*#__PURE__*/React.createElement("span", {
    className: "adm-stock-meta"
  }, /*#__PURE__*/React.createElement("code", {
    className: "adm-code"
  }, p.id), /*#__PURE__*/React.createElement("span", {
    style: {
      textTransform: "capitalize"
    }
  }, p.cat))), /*#__PURE__*/React.createElement("div", {
    className: "adm-stock-sizes"
  }, p.sizes.map(sz => /*#__PURE__*/React.createElement("div", {
    key: sz,
    className: "adm-size-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-size-lbl"
  }, sz), /*#__PURE__*/React.createElement(StockCell, {
    pid: p.id,
    sz: sz,
    get: get,
    set: set
  }))))))));
}

// ── Tab: Configuración ────────────────────────────────────
function ChangePwForm() {
  var [cur, setCur] = useState("");
  var [nxt, setNxt] = useState("");
  var [rep, setRep] = useState("");
  var [msg, setMsg] = useState(null);
  var [busy, setBusy] = useState(false);
  var submit = async e => {
    e.preventDefault();
    if (nxt !== rep) {
      setMsg({
        ok: false,
        t: "Las nuevas contraseñas no coinciden."
      });
      return;
    }
    if (nxt.length < 6) {
      setMsg({
        ok: false,
        t: "Mínimo 6 caracteres."
      });
      return;
    }
    setBusy(true);
    // Verificar la contraseña actual reautenticando
    var auth = await window.VETA_DB.signIn(cur);
    if (!auth.ok) {
      setMsg({
        ok: false,
        t: "Contraseña actual incorrecta."
      });
      setBusy(false);
      return;
    }
    var res = await window.VETA_DB.changePassword(nxt);
    if (!res.ok) {
      setMsg({
        ok: false,
        t: res.error || "No se pudo cambiar la contraseña."
      });
      setBusy(false);
      return;
    }
    setMsg({
      ok: true,
      t: "Contraseña cambiada correctamente."
    });
    setCur("");
    setNxt("");
    setRep("");
    setBusy(false);
  };
  return /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    className: "adm-pw-form"
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    className: "adm-input adm-input--sm",
    placeholder: "Contrase\xF1a actual",
    value: cur,
    onChange: e => setCur(e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    type: "password",
    className: "adm-input adm-input--sm",
    placeholder: "Nueva contrase\xF1a",
    value: nxt,
    onChange: e => setNxt(e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    type: "password",
    className: "adm-input adm-input--sm",
    placeholder: "Repetir nueva",
    value: rep,
    onChange: e => setRep(e.target.value)
  }), msg && /*#__PURE__*/React.createElement("p", {
    className: `adm-msg${msg.ok ? " adm-msg--ok" : " adm-msg--err"}`
  }, msg.t), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "adm-btn adm-btn--primary adm-btn--sm",
    disabled: busy || !cur || !nxt || !rep
  }, busy ? "Guardando…" : "Cambiar contraseña"));
}
function TabConfig({
  cfg,
  save,
  onLogout,
  resetProducts
}) {
  var [phone, setPhone] = useState(cfg.wa_phone);
  var [savedPhone, setSavedPhone] = useState(false);
  var [limit, setLimit] = useState(cfg.bot_daily_limit);
  var [savedLimit, setSavedLimit] = useState(false);
  useEffect(() => {
    setPhone(cfg.wa_phone);
  }, [cfg.wa_phone]);
  useEffect(() => {
    setLimit(cfg.bot_daily_limit);
  }, [cfg.bot_daily_limit]);
  return /*#__PURE__*/React.createElement("div", {
    className: "adm-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-cfg-section"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "adm-cfg-h"
  }, "WhatsApp del negocio"), /*#__PURE__*/React.createElement("p", {
    className: "adm-hint"
  }, "N\xFAmero con c\xF3digo de pa\xEDs, sin + ni espacios. Ej: 573001234567"), /*#__PURE__*/React.createElement("div", {
    className: "adm-row-inline"
  }, /*#__PURE__*/React.createElement("input", {
    className: "adm-input",
    value: phone,
    onChange: e => setPhone(e.target.value),
    style: {
      maxWidth: 260
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--primary adm-btn--sm",
    onClick: () => {
      save({
        wa_phone: phone.replace(/\D/g, "")
      });
      setSavedPhone(true);
      setTimeout(() => setSavedPhone(false), 2000);
    }
  }, savedPhone ? "Guardado ✓" : "Guardar"))), /*#__PURE__*/React.createElement("hr", {
    className: "adm-hr"
  }), /*#__PURE__*/React.createElement("div", {
    className: "adm-cfg-section"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "adm-cfg-h"
  }, "L\xEDmite diario del bot IA"), /*#__PURE__*/React.createElement("p", {
    className: "adm-hint"
  }, "M\xE1ximo de mensajes que el bot responde por cliente cada d\xEDa. Al alcanzarlo, avisa que un asesor lo atender\xE1. Por defecto: 10."), /*#__PURE__*/React.createElement("div", {
    className: "adm-row-inline"
  }, /*#__PURE__*/React.createElement("input", {
    className: "adm-input",
    type: "number",
    min: "1",
    max: "200",
    value: limit,
    onChange: e => setLimit(Math.max(1, parseInt(e.target.value) || 1)),
    style: {
      maxWidth: 100
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--primary adm-btn--sm",
    onClick: () => {
      save({
        bot_daily_limit: String(limit)
      });
      setSavedLimit(true);
      setTimeout(() => setSavedLimit(false), 2000);
    }
  }, savedLimit ? "Guardado ✓" : "Guardar"))), /*#__PURE__*/React.createElement("hr", {
    className: "adm-hr"
  }), /*#__PURE__*/React.createElement("div", {
    className: "adm-cfg-section"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "adm-cfg-h"
  }, "Cambiar contrase\xF1a"), /*#__PURE__*/React.createElement("p", {
    className: "adm-hint"
  }, "Contrase\xF1a por defecto: ", /*#__PURE__*/React.createElement("code", {
    className: "adm-code"
  }, "veta2026"), ". C\xE1mbiala tras el primer acceso."), /*#__PURE__*/React.createElement(ChangePwForm, null)), /*#__PURE__*/React.createElement("hr", {
    className: "adm-hr"
  }), /*#__PURE__*/React.createElement("div", {
    className: "adm-cfg-section"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "adm-cfg-h"
  }, "Datos de productos"), /*#__PURE__*/React.createElement("p", {
    className: "adm-hint"
  }, "Restablece el cat\xE1logo al estado inicial (productos de data.js). Los productos personalizados se perder\xE1n."), /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--ghost",
    onClick: () => {
      if (window.confirm("¿Restablecer el catálogo a los productos originales? Los cambios en productos se perderán.")) resetProducts();
    }
  }, "Restablecer cat\xE1logo original")), /*#__PURE__*/React.createElement("hr", {
    className: "adm-hr"
  }), /*#__PURE__*/React.createElement("div", {
    className: "adm-cfg-section"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "adm-cfg-h"
  }, "Sesi\xF3n"), /*#__PURE__*/React.createElement("p", {
    className: "adm-hint"
  }, "La sesi\xF3n se cierra autom\xE1ticamente al cerrar el navegador."), /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--ghost",
    onClick: onLogout
  }, "Cerrar sesi\xF3n")), /*#__PURE__*/React.createElement("hr", {
    className: "adm-hr"
  }), /*#__PURE__*/React.createElement("p", {
    className: "adm-note"
  }, /*#__PURE__*/React.createElement("strong", null, "Nota:"), " Stock, visibilidad, productos y configuraci\xF3n se guardan en Supabase y est\xE1n disponibles desde cualquier dispositivo en tiempo real."));
}

// ── Shell con sidebar ─────────────────────────────────────
var ADMIN_TABS = [{
  id: "inicio",
  label: "Inicio"
}, {
  id: "productos",
  label: "Productos"
}, {
  id: "stock",
  label: "Stock"
}, {
  id: "config",
  label: "Config."
}];
function AdminShell({
  onLogout
}) {
  var [tab, setTab] = useState("inicio");
  var {
    products: rawProducts,
    add,
    update,
    remove,
    resetToSeed
  } = useProducts();
  var {
    stock,
    set: setStock,
    get: getStock,
    reset: resetStock
  } = useStock();
  var {
    cfg,
    save: saveCfg
  } = useCfg();
  var toggleHidden = useCallback(async id => {
    var p = (window.VETA_DB.getProducts() || []).find(x => x.id === id);
    var currentlyVisible = p ? p.visible !== false : true;
    try {
      await window.VETA_DB.setVisible(id, !currentlyVisible);
    } catch (e) {
      adminToast("No se pudo cambiar la visibilidad: " + e.message, true);
    }
  }, []);
  var products = rawProducts.map(p => ({
    ...p,
    hidden: p.visible === false
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "adm-shell"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "adm-sidebar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-sb-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-sb-logo"
  }, "VETA"), /*#__PURE__*/React.createElement("span", {
    className: "adm-sb-badge"
  }, "Admin")), /*#__PURE__*/React.createElement("nav", {
    className: "adm-sb-nav"
  }, ADMIN_TABS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    className: `adm-sb-btn${tab === t.id ? " adm-sb-btn--on" : ""}`,
    onClick: () => setTab(t.id)
  }, t.label))), /*#__PURE__*/React.createElement("div", {
    className: "adm-sb-foot"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#home",
    className: "adm-sb-link"
  }, "\u2190 Ver tienda"), /*#__PURE__*/React.createElement("button", {
    className: "adm-sb-link",
    onClick: onLogout,
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0,
      textAlign: "left"
    }
  }, "Cerrar sesi\xF3n"))), /*#__PURE__*/React.createElement("div", {
    className: "adm-body"
  }, /*#__PURE__*/React.createElement("header", {
    className: "adm-hdr"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "adm-hdr-title"
  }, ADMIN_TABS.find(t => t.id === tab)?.label), /*#__PURE__*/React.createElement("span", {
    className: "adm-hdr-meta"
  }, "VETA \xB7 Panel en la nube")), /*#__PURE__*/React.createElement("div", {
    className: "adm-content"
  }, tab === "inicio" && /*#__PURE__*/React.createElement(TabInicio, {
    products: products,
    stock: stock
  }), tab === "productos" && /*#__PURE__*/React.createElement(TabProductos, {
    products: products,
    addProduct: add,
    updateProduct: update,
    removeProduct: remove,
    toggleHidden: toggleHidden
  }), tab === "stock" && /*#__PURE__*/React.createElement(TabStock, {
    products: products,
    get: getStock,
    set: setStock,
    reset: resetStock
  }), tab === "config" && /*#__PURE__*/React.createElement(TabConfig, {
    cfg: cfg,
    save: saveCfg,
    onLogout: onLogout,
    resetProducts: resetToSeed
  }))), /*#__PURE__*/React.createElement("nav", {
    className: "adm-mob-tabs"
  }, ADMIN_TABS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    className: `adm-mob-btn${tab === t.id ? " adm-mob-btn--on" : ""}`,
    onClick: () => setTab(t.id)
  }, t.label))));
}

// ── Raíz ──────────────────────────────────────────────────
function AdminPanel() {
  var {
    authed,
    ready,
    loading,
    err,
    login,
    logout
  } = useAuth();
  return /*#__PURE__*/React.createElement(React.Fragment, null, !ready ? /*#__PURE__*/React.createElement("div", {
    className: "adm-login-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-login-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-login-logo"
  }, "VETA"), /*#__PURE__*/React.createElement("p", {
    className: "adm-login-sub"
  }, "Cargando\u2026"))) : authed ? /*#__PURE__*/React.createElement(AdminShell, {
    onLogout: logout
  }) : /*#__PURE__*/React.createElement(AdminLogin, {
    onLogin: login,
    loading: loading,
    err: err
  }), /*#__PURE__*/React.createElement(Toaster, null));
}
window.AdminPanel = AdminPanel;
