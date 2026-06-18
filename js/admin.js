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

// ── Tab: Chats (buzón de WhatsApp estilo WhatsApp) ────────
var CHAT_SEEN_KEY = "veta_chat_seen";
function loadSeen() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_SEEN_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveSeen(m) {
  try {
    localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(m));
  } catch {}
}
function chatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}
function chatDayLabel(iso) {
  var d = new Date(iso);
  var now = new Date();
  var sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return "Hoy";
  var yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay(d, yest)) return "Ayer";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}
function chatListTime(iso) {
  var d = new Date(iso);
  var now = new Date();
  if (d.toDateString() === now.toDateString()) return chatTime(iso);
  var yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit"
  });
}
function chatInitial(name, phone) {
  var s = (name || "").trim();
  if (s) return s[0].toUpperCase();
  return (phone || "?").slice(-2, -1) || "#";
}
function fmtPhone(phone) {
  // 573001234567 → +57 300 123 4567 (aprox., solo presentación)
  if (!phone) return "";
  var p = phone.replace(/\D/g, "");
  if (p.length === 12 && p.startsWith("57")) return `+57 ${p.slice(2, 5)} ${p.slice(5, 8)} ${p.slice(8)}`;
  return "+" + p;
}
var ROLE_OUT = {
  assistant: true,
  agent: true
}; // salientes (derecha)

// En móvil (táctil) Enter = salto de línea; se envía solo con el botón.
var CHAT_IS_TOUCH = typeof window !== "undefined" && ("ontouchstart" in window || window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

// Inserta un mensaje manteniendo el orden por created_at, para que un mensaje
// que llega por realtime no quede fuera de lugar respecto a su par.
function insertSortedMsg(list, row) {
  if (list.some(m => m.id === row.id)) return list;
  var next = [...list, row];
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
  var [count, setCount] = useState(0);
  useEffect(() => {
    if (!window.VETA_DB) return;
    var alive = true;
    var recompute = async () => {
      try {
        await window.VETA_DB.loadThreads();
        var th = window.VETA_DB.getThreads();
        var n = Object.values(th).filter(t => t.needs_human).length;
        if (alive) setCount(n);
      } catch {}
    };
    recompute();
    var unsub = window.VETA_DB.subscribeChats(() => recompute());
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  return count;
}
function useDespBadge() {
  var [count, setCount] = useState(0);
  useEffect(() => {
    if (!window.VETA_DB) return;
    var alive = true;
    window.VETA_DB.getOrders("pending").then(data => {
      if (alive) setCount(data.length);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return count;
}
function ChatBubbleRow({
  msg,
  prev,
  byMid
}) {
  var out = ROLE_OUT[msg.role];
  var tag = msg.role === "assistant" ? "IA" : msg.role === "agent" ? "Tú" : null;
  var showDay = !prev || chatDayLabel(prev.created_at) !== chatDayLabel(msg.created_at);
  var quoted = msg.reply_to ? byMid && byMid[msg.reply_to] : null;
  var isImg = msg.msg_type === "image" && msg.media_url;
  var caption = isImg && msg.content && msg.content !== "[imagen]" ? msg.content : "";
  return /*#__PURE__*/React.createElement(React.Fragment, null, showDay && /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-daysep"
  }, /*#__PURE__*/React.createElement("span", null, chatDayLabel(msg.created_at))), /*#__PURE__*/React.createElement("div", {
    className: `adm-chat-msg ${out ? "adm-chat-msg--out" : "adm-chat-msg--in"} adm-chat-msg--${msg.role}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-bubble"
  }, tag && /*#__PURE__*/React.createElement("span", {
    className: `adm-chat-tag adm-chat-tag--${msg.role}`
  }, tag), msg.reply_to && /*#__PURE__*/React.createElement("span", {
    className: `adm-chat-quote${quoted ? ` adm-chat-quote--${quoted.role}` : ""}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-chat-quote-text"
  }, quoted ? msgPreview(quoted) : "Mensaje citado")), isImg && /*#__PURE__*/React.createElement("a", {
    className: "adm-chat-img-wrap",
    href: msg.media_url,
    target: "_blank",
    rel: "noopener noreferrer"
  }, /*#__PURE__*/React.createElement("img", {
    className: "adm-chat-img",
    src: msg.media_url,
    alt: "Imagen",
    loading: "lazy"
  })), (!isImg || caption) && /*#__PURE__*/React.createElement("span", {
    className: "adm-chat-text"
  }, isImg ? caption : msg.content), /*#__PURE__*/React.createElement("span", {
    className: "adm-chat-meta"
  }, chatTime(msg.created_at)))));
}
function TabChats() {
  var [list, setList] = useState([]);
  var [loading, setLoading] = useState(true);
  var [active, setActive] = useState(null); // phone
  var [messages, setMessages] = useState([]);
  var [msgLoading, setMsgLoading] = useState(false);
  var [filter, setFilter] = useState("todos"); // todos | atencion | pausa
  var [q, setQ] = useState("");
  var [seen, setSeen] = useState(loadSeen);
  var [draft, setDraft] = useState("");
  var [sending, setSending] = useState(false);
  var [orders, setOrders] = useState([]);
  var [pendingImg, setPendingImg] = useState(null); // { file, url } imagen a enviar

  var activeRef = useRef(active);
  activeRef.current = active;
  var endRef = useRef(null);
  var fileRef = useRef(null);

  // Mapa wa_mid -> mensaje, para resolver las citas (reply/quote).
  var byMid = useMemo(() => {
    var m = {};
    messages.forEach(x => {
      if (x.wa_mid) m[x.wa_mid] = x;
    });
    return m;
  }, [messages]);
  var reloadList = useCallback(async () => {
    if (!window.VETA_DB) return;
    await window.VETA_DB.loadThreads();
    var l = await window.VETA_DB.getConversationList();
    setList(l);
    setLoading(false);
  }, []);
  var openThread = useCallback(async phone => {
    setActive(phone);
    setMsgLoading(true);
    setOrders([]);
    var msgs = await window.VETA_DB.getMessages(phone);
    setMessages(msgs);
    setMsgLoading(false);
    setSeen(prev => {
      var n = {
        ...prev,
        [phone]: new Date().toISOString()
      };
      saveSeen(n);
      return n;
    });
    var th = window.VETA_DB.getThreads()[phone];
    if (th?.needs_human) {
      try {
        await window.VETA_DB.clearNeedsHuman(phone);
      } catch {}
    }
    try {
      var {
        data
      } = await window.VETA_DB.sb.from("wa_orders").select("*").eq("phone", phone).order("created_at", {
        ascending: false
      });
      setOrders(data || []);
    } catch {
      setOrders([]);
    }
  }, []);
  useEffect(() => {
    reloadList();
    if (!window.VETA_DB) return;
    var unsub = window.VETA_DB.subscribeChats(ev => {
      if (ev.type === "message" && ev.row && ev.row.phone === activeRef.current) {
        setMessages(prev => insertSortedMsg(prev, ev.row));
        setSeen(prev => {
          var n = {
            ...prev,
            [ev.row.phone]: new Date().toISOString()
          };
          saveSeen(n);
          return n;
        });
      }
      reloadList();
    });
    return unsub;
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end"
    });
  }, [messages]);
  var unreadOf = c => {
    var s = seen[c.phone];
    return c.last && (!s || new Date(c.last.created_at) > new Date(s)) && c.last.phone !== undefined && c.last.role === "user";
  };
  var filtered = list.filter(c => {
    if (filter === "atencion" && !(c.thread && c.thread.needs_human)) return false;
    if (filter === "pausa" && !(c.thread && c.thread.bot_paused)) return false;
    if (q) {
      var hay = (c.thread?.customer_name || "") + " " + c.phone;
      if (!hay.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  });
  var activeThread = list.find(c => c.phone === active)?.thread || active && window.VETA_DB.getThreads()[active] || null;
  var activeName = activeThread?.customer_name || "";
  var paused = !!activeThread?.bot_paused;
  var atencionCount = list.filter(c => c.thread && c.thread.needs_human).length;
  var toggleControl = async () => {
    if (!active) return;
    try {
      await window.VETA_DB.setBotPaused(active, !paused);
      adminToast(!paused ? "Tomaste el control. La IA quedó en pausa para este chat." : "La IA retoma este chat.");
      reloadList();
    } catch (e) {
      adminToast("No se pudo cambiar: " + e.message, true);
    }
  };
  var clearPendingImg = () => {
    setPendingImg(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  };
  var onPickImage = e => {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type || "")) {
      adminToast("Selecciona un archivo de imagen.", true);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      adminToast("La imagen supera 5 MB.", true);
      return;
    }
    setPendingImg(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return {
        file,
        url: URL.createObjectURL(file)
      };
    });
  };
  var send = async () => {
    var text = draft.trim();
    if (!text && !pendingImg || !active || sending) return;
    setSending(true);
    try {
      if (pendingImg) {
        var mediaUrl = await window.VETA_DB.uploadChatImage(active, pendingImg.file);
        await window.VETA_DB.sendAgentMessage(active, {
          text,
          type: "image",
          mediaUrl
        });
      } else {
        await window.VETA_DB.sendAgentMessage(active, text);
      }
      setDraft("");
      clearPendingImg();
      var msgs = await window.VETA_DB.getMessages(active);
      setMessages(msgs);
      reloadList();
    } catch (e) {
      adminToast(e.message || "No se pudo enviar.", true);
    }
    setSending(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `adm-chat ${active ? "adm-chat--thread-open" : ""}`
  }, /*#__PURE__*/React.createElement("aside", {
    className: "adm-chat-list"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-list-top"
  }, /*#__PURE__*/React.createElement("input", {
    className: "adm-input adm-input--sm",
    placeholder: "Buscar por nombre o n\xFAmero\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-filters"
  }, /*#__PURE__*/React.createElement("button", {
    className: `adm-pill${filter === "todos" ? " adm-pill--on" : ""}`,
    onClick: () => setFilter("todos")
  }, "Todos"), /*#__PURE__*/React.createElement("button", {
    className: `adm-pill${filter === "atencion" ? " adm-pill--on" : ""}`,
    onClick: () => setFilter("atencion")
  }, "Requieren atenci\xF3n", atencionCount > 0 ? ` · ${atencionCount}` : ""), /*#__PURE__*/React.createElement("button", {
    className: `adm-pill${filter === "pausa" ? " adm-pill--on" : ""}`,
    onClick: () => setFilter("pausa")
  }, "En pausa"))), /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-list-scroll"
  }, loading && /*#__PURE__*/React.createElement("p", {
    className: "adm-empty"
  }, "Cargando conversaciones\u2026"), !loading && filtered.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "adm-empty"
  }, q || filter !== "todos" ? "Sin conversaciones que coincidan." : "Aún no hay conversaciones."), filtered.map(c => {
    var needs = c.thread && c.thread.needs_human;
    var isPaused = c.thread && c.thread.bot_paused;
    var unread = unreadOf(c);
    return /*#__PURE__*/React.createElement("button", {
      key: c.phone,
      className: `adm-chat-item${active === c.phone ? " adm-chat-item--on" : ""}${needs ? " adm-chat-item--alert" : ""}`,
      onClick: () => openThread(c.phone)
    }, /*#__PURE__*/React.createElement("span", {
      className: "adm-chat-avatar"
    }, chatInitial(c.thread?.customer_name, c.phone)), /*#__PURE__*/React.createElement("span", {
      className: "adm-chat-item-body"
    }, /*#__PURE__*/React.createElement("span", {
      className: "adm-chat-item-top"
    }, /*#__PURE__*/React.createElement("span", {
      className: "adm-chat-item-name"
    }, c.thread?.customer_name || fmtPhone(c.phone)), /*#__PURE__*/React.createElement("span", {
      className: "adm-chat-item-time"
    }, chatListTime(c.last.created_at))), /*#__PURE__*/React.createElement("span", {
      className: "adm-chat-item-bottom"
    }, /*#__PURE__*/React.createElement("span", {
      className: "adm-chat-item-prev"
    }, c.last.role === "user" ? "" : c.last.role === "agent" ? "Tú: " : "IA: ", msgPreview(c.last)), /*#__PURE__*/React.createElement("span", {
      className: "adm-chat-item-badges"
    }, needs && /*#__PURE__*/React.createElement("span", {
      className: "adm-chat-dot adm-chat-dot--alert",
      title: "Requiere asesor"
    }, "!"), isPaused && /*#__PURE__*/React.createElement("span", {
      className: "adm-chat-pill-mini",
      title: "IA en pausa"
    }, "\u23F8"), unread && !needs && /*#__PURE__*/React.createElement("span", {
      className: "adm-chat-dot"
    })))));
  }))), /*#__PURE__*/React.createElement("section", {
    className: "adm-chat-thread"
  }, !active && /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-empty-logo"
  }, "VETA"), /*#__PURE__*/React.createElement("p", null, "Selecciona una conversaci\xF3n para ver y responder los mensajes."), /*#__PURE__*/React.createElement("p", {
    className: "adm-hint"
  }, "Las conversaciones llegan en tiempo real desde WhatsApp.")), active && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("header", {
    className: "adm-chat-thread-hdr"
  }, /*#__PURE__*/React.createElement("button", {
    className: "adm-chat-back",
    onClick: () => setActive(null),
    title: "Volver"
  }, "\u2190"), /*#__PURE__*/React.createElement("span", {
    className: "adm-chat-avatar"
  }, chatInitial(activeName, active)), /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-thread-id"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-chat-thread-name"
  }, activeName || fmtPhone(active)), /*#__PURE__*/React.createElement("span", {
    className: "adm-chat-thread-sub"
  }, fmtPhone(active), paused ? " · IA en pausa" : " · IA activa", orders.length > 0 ? ` · ${orders.length} pedido${orders.length > 1 ? "s" : ""}` : "")), /*#__PURE__*/React.createElement("button", {
    className: `adm-btn adm-btn--sm ${paused ? "adm-btn--primary" : "adm-btn--ghost"}`,
    onClick: toggleControl
  }, paused ? "Devolver a la IA" : "Tomar control")), paused && /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-banner"
  }, "Est\xE1s atendiendo este chat \u2014 la IA no responder\xE1 hasta que lo devuelvas."), /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-scroll"
  }, msgLoading && /*#__PURE__*/React.createElement("p", {
    className: "adm-empty"
  }, "Cargando mensajes\u2026"), !msgLoading && messages.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "adm-empty"
  }, "Sin mensajes todav\xEDa."), messages.map((m, i) => /*#__PURE__*/React.createElement(ChatBubbleRow, {
    key: m.id || i,
    msg: m,
    prev: messages[i - 1],
    byMid: byMid
  })), /*#__PURE__*/React.createElement("div", {
    ref: endRef
  })), /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-composer"
  }, pendingImg && /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-attach"
  }, /*#__PURE__*/React.createElement("img", {
    src: pendingImg.url,
    alt: "Adjunto",
    className: "adm-chat-attach-thumb"
  }), /*#__PURE__*/React.createElement("button", {
    className: "adm-chat-attach-x",
    onClick: clearPendingImg,
    title: "Quitar imagen"
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "adm-chat-composer-row"
  }, /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: "image/*",
    hidden: true,
    onChange: onPickImage
  }), /*#__PURE__*/React.createElement("button", {
    className: "adm-chat-attach-btn",
    onClick: () => fileRef.current && fileRef.current.click(),
    disabled: sending,
    title: "Adjuntar imagen"
  }, "\uD83D\uDCCE"), /*#__PURE__*/React.createElement("textarea", {
    className: "adm-chat-input",
    rows: 1,
    placeholder: "Escribe un mensaje\u2026",
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && !e.shiftKey && !CHAT_IS_TOUCH) {
        e.preventDefault();
        send();
      }
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "adm-chat-send",
    onClick: send,
    disabled: sending || !draft.trim() && !pendingImg,
    title: "Enviar"
  }, sending ? "…" : "➤"))))));
}

// ── Tab: Descuentos ──────────────────────────────────────
function useDiscountCodes() {
  var [codes, setCodes] = useState(() => window.VETA_DB ? window.VETA_DB.getDiscountCodes() : []);
  useEffect(() => {
    if (!window.VETA_DB) return;
    return window.VETA_DB.subscribe(() => setCodes(window.VETA_DB.getDiscountCodes().slice()));
  }, []);
  var upsert = useCallback(async data => {
    try {
      await window.VETA_DB.upsertDiscountCode(data);
      adminToast(data.id ? "Código guardado." : "Código creado.");
      return true;
    } catch (e) {
      adminToast("No se pudo guardar: " + e.message, true);
      return false;
    }
  }, []);
  var remove = useCallback(async id => {
    try {
      await window.VETA_DB.deleteDiscountCode(id);
      adminToast("Código eliminado.");
    } catch (e) {
      adminToast("No se pudo eliminar: " + e.message, true);
    }
  }, []);
  var toggleActive = useCallback(async code => {
    try {
      await window.VETA_DB.upsertDiscountCode({
        ...code,
        id: code.id,
        active: !code.active
      });
    } catch (e) {
      adminToast("No se pudo cambiar: " + e.message, true);
    }
  }, []);
  var toggleShowOnSite = useCallback(async code => {
    try {
      await window.VETA_DB.upsertDiscountCode({
        ...code,
        id: code.id,
        show_on_site: !code.show_on_site
      });
    } catch (e) {
      adminToast("No se pudo cambiar: " + e.message, true);
    }
  }, []);
  return {
    codes,
    upsert,
    remove,
    toggleActive,
    toggleShowOnSite
  };
}
var DISC_EMPTY = {
  code: "",
  description: "",
  type: "percent",
  value: "",
  min_subtotal: "",
  max_uses: "",
  active: true,
  show_on_site: false,
  expires_at: ""
};
function DiscountForm({
  initial,
  onSave,
  onCancel
}) {
  var isNew = !initial?.id;
  var [form, setForm] = useState(() => initial ? {
    ...initial,
    value: String(initial.value || ""),
    min_subtotal: String(initial.min_subtotal || ""),
    max_uses: initial.max_uses !== null && initial.max_uses !== undefined ? String(initial.max_uses) : "",
    expires_at: initial.expires_at ? initial.expires_at.slice(0, 10) : ""
  } : {
    ...DISC_EMPTY
  });
  var [errors, setErrors] = useState({});
  var set = useCallback((k, v) => setForm(f => ({
    ...f,
    [k]: v
  })), []);
  var validate = () => {
    var e = {};
    if (!form.code.trim()) e.code = "El código es obligatorio.";
    if (!form.value || Number(form.value) <= 0) e.value = "El valor debe ser mayor a 0.";
    if (form.type === "percent" && Number(form.value) > 100) e.value = "El porcentaje no puede superar 100.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  var submit = async e => {
    e.preventDefault();
    if (!validate()) return;
    var ok = await onSave({
      id: form.id,
      code: form.code.toUpperCase().trim(),
      description: form.description.trim(),
      type: form.type,
      value: Number(form.value),
      min_subtotal: Number(form.min_subtotal) || 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      active: form.active,
      show_on_site: form.show_on_site,
      expires_at: form.expires_at || null
    });
    if (ok) onCancel();
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "adm-disc-form-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-form-topbar"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "adm-back-btn",
    onClick: onCancel
  }, "\u2190 Volver"), /*#__PURE__*/React.createElement("h2", {
    className: "adm-form-title"
  }, isNew ? "Nuevo código de descuento" : `Editar · ${initial.code}`)), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    className: "adm-product-form"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-form-card"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "adm-form-card-h"
  }, "C\xF3digo y descripci\xF3n"), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field adm-form-field--full"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "C\xF3digo ", /*#__PURE__*/React.createElement("span", {
    className: "adm-required"
  }, "*")), /*#__PURE__*/React.createElement("input", {
    className: `adm-input adm-input--mono${errors.code ? " adm-input--err" : ""}`,
    value: form.code,
    onChange: e => set("code", e.target.value.toUpperCase()),
    placeholder: "VETAINAUGURACI\xD3N",
    style: {
      textTransform: "uppercase",
      letterSpacing: "0.05em"
    }
  }), errors.code && /*#__PURE__*/React.createElement("span", {
    className: "adm-field-err"
  }, errors.code), /*#__PURE__*/React.createElement("span", {
    className: "adm-field-hint"
  }, "El cliente ingresar\xE1 este texto exacto en el carrito.")), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field adm-form-field--full"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Descripci\xF3n"), /*#__PURE__*/React.createElement("input", {
    className: "adm-input",
    value: form.description,
    onChange: e => set("description", e.target.value),
    placeholder: "Ej: 25% de descuento por inauguraci\xF3n"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-card"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "adm-form-card-h"
  }, "Tipo y valor"), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Tipo de descuento"), /*#__PURE__*/React.createElement("select", {
    className: "adm-input",
    value: form.type,
    onChange: e => set("type", e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "percent"
  }, "Porcentaje (%)"), /*#__PURE__*/React.createElement("option", {
    value: "fixed"
  }, "Valor fijo (COP)"))), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Valor ", /*#__PURE__*/React.createElement("span", {
    className: "adm-required"
  }, "*")), /*#__PURE__*/React.createElement("div", {
    className: "adm-price-row"
  }, /*#__PURE__*/React.createElement("input", {
    className: `adm-input${errors.value ? " adm-input--err" : ""}`,
    type: "number",
    min: "0",
    step: form.type === "percent" ? "1" : "1000",
    value: form.value,
    onChange: e => set("value", e.target.value),
    placeholder: form.type === "percent" ? "25" : "50000"
  }), /*#__PURE__*/React.createElement("span", {
    className: "adm-price-cur"
  }, form.type === "percent" ? "%" : "COP")), errors.value && /*#__PURE__*/React.createElement("span", {
    className: "adm-field-err"
  }, errors.value), Number(form.value) > 0 && /*#__PURE__*/React.createElement("span", {
    className: "adm-field-hint"
  }, form.type === "percent" ? `${form.value}% de descuento` : `${VETA_DATA.fmtPrice(Number(form.value))} de descuento`)), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Subtotal m\xEDnimo (COP)"), /*#__PURE__*/React.createElement("input", {
    className: "adm-input",
    type: "number",
    min: "0",
    step: "1000",
    value: form.min_subtotal,
    onChange: e => set("min_subtotal", e.target.value),
    placeholder: "0 = sin m\xEDnimo"
  })), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Usos m\xE1ximos"), /*#__PURE__*/React.createElement("input", {
    className: "adm-input",
    type: "number",
    min: "1",
    step: "1",
    value: form.max_uses,
    onChange: e => set("max_uses", e.target.value),
    placeholder: "Vac\xEDo = sin l\xEDmite"
  })), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-lbl"
  }, "Vence el"), /*#__PURE__*/React.createElement("input", {
    className: "adm-input",
    type: "date",
    value: form.expires_at,
    onChange: e => set("expires_at", e.target.value)
  }), /*#__PURE__*/React.createElement("span", {
    className: "adm-field-hint"
  }, "Vac\xEDo = no vence")))), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-card"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "adm-form-card-h"
  }, "Visibilidad"), /*#__PURE__*/React.createElement("div", {
    className: "adm-disc-toggles"
  }, /*#__PURE__*/React.createElement("label", {
    className: "adm-disc-toggle"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: form.active,
    onChange: e => set("active", e.target.checked)
  }), /*#__PURE__*/React.createElement("span", {
    className: "adm-disc-toggle-label"
  }, "C\xF3digo activo"), /*#__PURE__*/React.createElement("span", {
    className: "adm-field-hint"
  }, "Los clientes pueden usarlo")), /*#__PURE__*/React.createElement("label", {
    className: "adm-disc-toggle"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: form.show_on_site,
    onChange: e => set("show_on_site", e.target.checked)
  }), /*#__PURE__*/React.createElement("span", {
    className: "adm-disc-toggle-label"
  }, "Mostrar en el sitio"), /*#__PURE__*/React.createElement("span", {
    className: "adm-field-hint"
  }, "Aparece como banner en la tienda (para promociones p\xFAblicas)")))), /*#__PURE__*/React.createElement("div", {
    className: "adm-form-actions"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "adm-btn adm-btn--ghost",
    onClick: onCancel
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "adm-btn adm-btn--primary"
  }, isNew ? "Crear código" : "Guardar cambios"))));
}
function TabDescuentos() {
  var {
    codes,
    upsert,
    remove,
    toggleActive,
    toggleShowOnSite
  } = useDiscountCodes();
  var [view, setView] = useState("list"); // "list" | "new" | <code-obj>
  var [confirm, setConfirm] = useState(null); // id a eliminar

  if (view === "new" || view && typeof view === "object") {
    return /*#__PURE__*/React.createElement(DiscountForm, {
      initial: typeof view === "object" ? view : null,
      onSave: upsert,
      onCancel: () => setView("list")
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "adm-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-toolbar"
  }, /*#__PURE__*/React.createElement("p", {
    className: "adm-hint",
    style: {
      margin: 0,
      flex: 1
    }
  }, "Crea c\xF3digos que tus clientes ingresan en la bolsa para obtener descuento."), /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--primary adm-btn--sm",
    onClick: () => setView("new")
  }, "+ Nuevo c\xF3digo")), codes.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "adm-empty"
  }, "A\xFAn no hay c\xF3digos. \xA1Crea el primero!") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "adm-table-wrap adm-disc-table-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "adm-table adm-table--disc"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "C\xF3digo"), /*#__PURE__*/React.createElement("th", null, "Descripci\xF3n"), /*#__PURE__*/React.createElement("th", null, "Descuento"), /*#__PURE__*/React.createElement("th", null, "Usos"), /*#__PURE__*/React.createElement("th", null, "Vence"), /*#__PURE__*/React.createElement("th", null, "Activo"), /*#__PURE__*/React.createElement("th", null, "En sitio"), /*#__PURE__*/React.createElement("th", null, "Acciones"))), /*#__PURE__*/React.createElement("tbody", null, codes.map(c => {
    var expired = c.expires_at && new Date(c.expires_at) < new Date();
    var exhausted = c.max_uses !== null && c.uses_count >= c.max_uses;
    return /*#__PURE__*/React.createElement("tr", {
      key: c.id,
      className: !c.active || expired || exhausted ? "adm-row--dim" : ""
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("code", {
      className: "adm-code adm-disc-code"
    }, c.code)), /*#__PURE__*/React.createElement("td", {
      style: {
        color: "var(--ink-soft)",
        fontSize: 13
      }
    }, c.description || "—"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: "adm-disc-value"
    }, c.type === "percent" ? `${c.value}%` : VETA_DATA.fmtPrice(c.value), " OFF", c.min_subtotal > 0 && /*#__PURE__*/React.createElement("span", {
      className: "adm-disc-min"
    }, " (min ", VETA_DATA.fmtPrice(c.min_subtotal), ")"))), /*#__PURE__*/React.createElement("td", {
      style: {
        fontSize: 13,
        color: "var(--ink-soft)"
      }
    }, c.uses_count, c.max_uses !== null ? ` / ${c.max_uses}` : "", exhausted && /*#__PURE__*/React.createElement("span", {
      style: {
        color: "#c0392b",
        marginLeft: 4
      }
    }, "Agotado")), /*#__PURE__*/React.createElement("td", {
      style: {
        fontSize: 13,
        color: expired ? "#c0392b" : "var(--ink-soft)"
      }
    }, c.expires_at ? new Date(c.expires_at).toLocaleDateString("es-CO") : "Sin vencimiento", expired && " ⚠"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
      className: `adm-badge${c.active ? " adm-badge--on" : ""}`,
      onClick: () => toggleActive(c)
    }, c.active ? "Activo" : "Inactivo")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
      className: `adm-badge${c.show_on_site ? " adm-badge--on" : ""}`,
      onClick: () => toggleShowOnSite(c)
    }, c.show_on_site ? "Visible" : "Oculto")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      className: "adm-row-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "adm-action-btn",
      onClick: () => setView(c),
      title: "Editar"
    }, "\u270F"), confirm === c.id ? /*#__PURE__*/React.createElement("span", {
      className: "adm-disc-confirm-inline"
    }, /*#__PURE__*/React.createElement("button", {
      className: "adm-action-btn",
      onClick: () => setConfirm(null)
    }, "\u2717"), /*#__PURE__*/React.createElement("button", {
      className: "adm-action-btn adm-action-btn--del",
      onClick: () => {
        remove(c.id);
        setConfirm(null);
      }
    }, "\u2713")) : /*#__PURE__*/React.createElement("button", {
      className: "adm-action-btn adm-action-btn--del",
      onClick: () => setConfirm(c.id),
      title: "Eliminar"
    }, "\u2715"))));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "adm-disc-cards"
  }, codes.map(c => {
    var expired = c.expires_at && new Date(c.expires_at) < new Date();
    var exhausted = c.max_uses !== null && c.uses_count >= c.max_uses;
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      className: `adm-disc-card${!c.active || expired || exhausted ? " adm-disc-card--dim" : ""}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "adm-disc-card-top"
    }, /*#__PURE__*/React.createElement("code", {
      className: "adm-code adm-disc-code"
    }, c.code), /*#__PURE__*/React.createElement("span", {
      className: "adm-disc-value"
    }, c.type === "percent" ? `${c.value}%` : VETA_DATA.fmtPrice(c.value), " OFF")), c.description && /*#__PURE__*/React.createElement("p", {
      className: "adm-disc-card-desc"
    }, c.description), /*#__PURE__*/React.createElement("div", {
      className: "adm-disc-card-row"
    }, /*#__PURE__*/React.createElement("button", {
      className: `adm-badge${c.active ? " adm-badge--on" : ""}`,
      onClick: () => toggleActive(c)
    }, c.active ? "Activo" : "Inactivo"), /*#__PURE__*/React.createElement("button", {
      className: `adm-badge${c.show_on_site ? " adm-badge--on" : ""}`,
      onClick: () => toggleShowOnSite(c)
    }, c.show_on_site ? "Visible" : "Oculto"), /*#__PURE__*/React.createElement("div", {
      className: "adm-row-actions",
      style: {
        marginLeft: "auto"
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "adm-action-btn",
      onClick: () => setView(c),
      title: "Editar"
    }, "\u270F"), confirm === c.id ? /*#__PURE__*/React.createElement("span", {
      className: "adm-disc-confirm-inline"
    }, /*#__PURE__*/React.createElement("button", {
      className: "adm-action-btn",
      onClick: () => setConfirm(null)
    }, "\u2717"), /*#__PURE__*/React.createElement("button", {
      className: "adm-action-btn adm-action-btn--del",
      onClick: () => {
        remove(c.id);
        setConfirm(null);
      }
    }, "\u2713")) : /*#__PURE__*/React.createElement("button", {
      className: "adm-action-btn adm-action-btn--del",
      onClick: () => setConfirm(c.id),
      title: "Eliminar"
    }, "\u2715"))), (c.uses_count > 0 || c.max_uses !== null || c.expires_at) && /*#__PURE__*/React.createElement("p", {
      className: "adm-disc-card-meta"
    }, c.uses_count > 0 || c.max_uses !== null ? `Usos: ${c.uses_count}${c.max_uses !== null ? ` / ${c.max_uses}` : ""}` : "", exhausted && " · Agotado", c.expires_at && ` · Vence: ${new Date(c.expires_at).toLocaleDateString("es-CO")}`, expired && " ⚠"));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "adm-note",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Tip:"), " Los c\xF3digos con ", /*#__PURE__*/React.createElement("em", null, "\"Mostrar en sitio\""), " activo aparecen como un banner en la tienda para todos los visitantes. \xDAsalo para promociones p\xFAblicas. Para c\xF3digos privados (descuentos a clientes espec\xEDficos), deja esa opci\xF3n inactiva."));
}

// ── Tab: Despachos ────────────────────────────────────────
var DESP_LABELS = {
  pending: "Pendiente",
  dispatched: "Despachado",
  delivered: "Entregado",
  problem: "⚠ Problema",
  cancelled: "Cancelado"
};
var DESP_STATUSES = ["pending", "dispatched", "delivered", "problem", "cancelled"];
function parseOrderNotes(notes) {
  if (!notes) return {
    payment: "",
    address: ""
  };
  var dirIdx = notes.search(/dir:/i);
  var payMatch = notes.match(/pago:\s*([^.]+)/i);
  return {
    payment: payMatch ? payMatch[1].trim() : "",
    address: dirIdx >= 0 ? notes.slice(dirIdx + 4).trim() : ""
  };
}
var EyeOpen = () => /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "3"
}));
var EyeClosed = () => /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"
}), /*#__PURE__*/React.createElement("path", {
  d: "M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"
}), /*#__PURE__*/React.createElement("path", {
  d: "M10.73 10.73a3 3 0 0 0 4.24 4.24"
}), /*#__PURE__*/React.createElement("line", {
  x1: "1",
  y1: "1",
  x2: "23",
  y2: "23"
}));
function OrderCard({
  order,
  onStatusChange,
  onNotesSave,
  onDeliveryNotesSave,
  onDelete,
  onToggleHidden
}) {
  var [editingNotes, setEditingNotes] = useState(false);
  var [notesVal, setNotesVal] = useState(order.admin_notes || "");
  var [savingNotes, setSavingNotes] = useState(false);
  var [editingDelivery, setEditingDelivery] = useState(false);
  var [deliveryVal, setDeliveryVal] = useState(order.delivery_notes || "");
  var [savingDelivery, setSavingDelivery] = useState(false);
  var [statusBusy, setStatusBusy] = useState(false);
  var [confirmCancel, setConfirmCancel] = useState(false);
  var [confirmDelete, setConfirmDelete] = useState(false);
  var [actionBusy, setActionBusy] = useState(false);
  useEffect(() => {
    setNotesVal(order.admin_notes || "");
  }, [order.admin_notes]);
  useEffect(() => {
    setDeliveryVal(order.delivery_notes || "");
  }, [order.delivery_notes]);
  var {
    payment: legacyPayment,
    address: legacyAddress
  } = parseOrderNotes(order.notes);
  var address = order.address || legacyAddress || "";
  var nbhd = order.neighborhood || "";
  var aptRef = order.apt_ref || "";
  var payment = order.payment_method || legacyPayment || "";
  var recipient = order.recipient_name || "";
  var NA = "No proporcionó";
  var date = new Date(order.created_at).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  var time = new Date(order.created_at).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  var handleStatus = async e => {
    var s = e.target.value;
    if (s === order.status || statusBusy) return;
    setStatusBusy(true);
    await onStatusChange(order.id, s);
    setStatusBusy(false);
  };
  var handleSaveNotes = async () => {
    setSavingNotes(true);
    await onNotesSave(order.id, notesVal);
    setSavingNotes(false);
    setEditingNotes(false);
  };
  var handleSaveDelivery = async () => {
    setSavingDelivery(true);
    await onDeliveryNotesSave(order.id, deliveryVal);
    setSavingDelivery(false);
    setEditingDelivery(false);
  };
  var handleCancel = async () => {
    setActionBusy(true);
    await onStatusChange(order.id, "cancelled");
    setActionBusy(false);
    setConfirmCancel(false);
  };
  var handleDelete = async () => {
    setActionBusy(true);
    await onDelete(order.id);
    setActionBusy(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `adm-desp-card adm-desp-card--${order.status}${order.hidden ? " adm-desp-card--hidden" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-card-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: `adm-desp-pill adm-desp-pill--${order.status}`
  }, DESP_LABELS[order.status] || order.status), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-card-top-right"
  }, /*#__PURE__*/React.createElement("button", {
    className: `adm-desp-eye${order.hidden ? " adm-desp-eye--off" : ""}`,
    onClick: () => onToggleHidden(order.id, !order.hidden),
    title: order.hidden ? "Mostrar pedido" : "Ocultar pedido"
  }, order.hidden ? /*#__PURE__*/React.createElement(EyeClosed, null) : /*#__PURE__*/React.createElement(EyeOpen, null)), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-meta"
  }, order.order_number && /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-order-num"
  }, "#", order.order_number), /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-date"
  }, date), /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-date"
  }, time)))), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-customer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-name"
  }, order.customer_name || "Cliente"), /*#__PURE__*/React.createElement("a", {
    className: "adm-desp-phone",
    href: "https://wa.me/" + order.phone,
    target: "_blank",
    rel: "noopener"
  }, "+", order.phone)), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-items-block"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-items-lbl"
  }, "Piezas"), order.items), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-fields"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-lbl"
  }, "Ciudad"), order.city ? /*#__PURE__*/React.createElement("span", null, order.city, nbhd ? `, ${nbhd}` : "") : /*#__PURE__*/React.createElement("em", {
    className: "adm-desp-na"
  }, NA)), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-lbl"
  }, "Direcci\xF3n"), address ? /*#__PURE__*/React.createElement("span", null, address) : /*#__PURE__*/React.createElement("em", {
    className: "adm-desp-na"
  }, NA)), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-lbl"
  }, "Ref/Entrega"), aptRef ? /*#__PURE__*/React.createElement("span", null, aptRef) : /*#__PURE__*/React.createElement("em", {
    className: "adm-desp-na"
  }, NA)), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-lbl"
  }, "Pago"), payment ? /*#__PURE__*/React.createElement("span", null, payment) : /*#__PURE__*/React.createElement("em", {
    className: "adm-desp-na"
  }, NA)), recipient && /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-field adm-desp-field--gift"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-lbl"
  }, "Regalo para"), /*#__PURE__*/React.createElement("span", null, recipient))), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-notes-wrap"
  }, editingDelivery ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("textarea", {
    className: "adm-input adm-desp-notes-ta",
    value: deliveryVal,
    onChange: e => setDeliveryVal(e.target.value),
    placeholder: "Llamar a tal hora, dejar en porter\xEDa, instrucciones especiales de entrega\u2026",
    rows: 2
  }), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-notes-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--sm",
    onClick: () => {
      setDeliveryVal(order.delivery_notes || "");
      setEditingDelivery(false);
    }
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--primary adm-btn--sm",
    disabled: savingDelivery,
    onClick: handleSaveDelivery
  }, savingDelivery ? "Guardando…" : "Guardar"))) : /*#__PURE__*/React.createElement("button", {
    className: "adm-desp-notes-btn adm-desp-notes-btn--info",
    onClick: () => setEditingDelivery(true)
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-notes-icon"
  }, order.delivery_notes ? "📦" : "＋"), /*#__PURE__*/React.createElement("span", null, order.delivery_notes || "Información adicional de entrega"))), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-notes-wrap"
  }, editingNotes ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("textarea", {
    className: "adm-input adm-desp-notes-ta",
    value: notesVal,
    onChange: e => setNotesVal(e.target.value),
    placeholder: "Gu\xEDa de env\xEDo, transportadora, observaciones del admin\u2026",
    rows: 2
  }), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-notes-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--sm",
    onClick: () => {
      setNotesVal(order.admin_notes || "");
      setEditingNotes(false);
    }
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--primary adm-btn--sm",
    disabled: savingNotes,
    onClick: handleSaveNotes
  }, savingNotes ? "Guardando…" : "Guardar nota"))) : /*#__PURE__*/React.createElement("button", {
    className: "adm-desp-notes-btn",
    onClick: () => setEditingNotes(true)
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-notes-icon"
  }, order.admin_notes ? "📋" : "＋"), /*#__PURE__*/React.createElement("span", null, order.admin_notes || "Nota de despacho (admin)"))), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-actions-col"
  }, /*#__PURE__*/React.createElement("select", {
    className: "adm-desp-status-select",
    value: order.status,
    disabled: statusBusy,
    onChange: handleStatus
  }, DESP_STATUSES.map(s => /*#__PURE__*/React.createElement("option", {
    key: s,
    value: s
  }, DESP_LABELS[s]))), !confirmCancel ? /*#__PURE__*/React.createElement("button", {
    className: "adm-desp-action-btn adm-desp-action-btn--cancel",
    disabled: actionBusy || order.status === "cancelled",
    onClick: () => setConfirmCancel(true)
  }, "Cancelar pedido") : /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-confirm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-confirm-q"
  }, "\xBFCancelar este pedido?"), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-confirm-btns"
  }, /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--sm",
    onClick: () => setConfirmCancel(false)
  }, "No"), /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--danger adm-btn--sm",
    disabled: actionBusy,
    onClick: handleCancel
  }, actionBusy ? "…" : "Sí, cancelar"))), !confirmDelete ? /*#__PURE__*/React.createElement("button", {
    className: "adm-desp-action-btn adm-desp-action-btn--delete",
    disabled: actionBusy,
    onClick: () => setConfirmDelete(true)
  }, "Eliminar pedido") : /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-confirm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-confirm-q"
  }, "\xBFEliminar definitivamente?"), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-confirm-btns"
  }, /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--sm",
    onClick: () => setConfirmDelete(false)
  }, "No"), /*#__PURE__*/React.createElement("button", {
    className: "adm-btn adm-btn--danger adm-btn--sm",
    disabled: actionBusy,
    onClick: handleDelete
  }, actionBusy ? "…" : "Eliminar")))));
}
function TabDespachos() {
  var [orders, setOrders] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState("active");
  var [q, setQ] = useState("");
  var load = useCallback(async () => {
    setLoading(true);
    try {
      var data = await window.VETA_DB.getOrders();
      setOrders(data);
    } catch (e) {
      adminToast("No se pudieron cargar los despachos: " + e.message, true);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  var handleStatusChange = async (id, newStatus) => {
    try {
      await window.VETA_DB.updateOrderStatus(id, newStatus);
      setOrders(prev => prev.map(o => o.id === id ? {
        ...o,
        status: newStatus
      } : o));
      adminToast("Estado actualizado.");
    } catch (e) {
      adminToast("No se pudo actualizar: " + e.message, true);
    }
  };
  var handleNotesSave = async (id, notes) => {
    try {
      await window.VETA_DB.updateOrderNotes(id, notes);
      setOrders(prev => prev.map(o => o.id === id ? {
        ...o,
        admin_notes: notes
      } : o));
      adminToast("Nota guardada.");
    } catch (e) {
      adminToast("No se pudo guardar: " + e.message, true);
    }
  };
  var handleDeliveryNotesSave = async (id, delivery_notes) => {
    try {
      await window.VETA_DB.updateOrderDeliveryNotes(id, delivery_notes);
      setOrders(prev => prev.map(o => o.id === id ? {
        ...o,
        delivery_notes
      } : o));
      adminToast("Nota guardada.");
    } catch (e) {
      adminToast("No se pudo guardar: " + e.message, true);
    }
  };
  var handleDelete = async id => {
    try {
      await window.VETA_DB.deleteOrder(id);
      setOrders(prev => prev.filter(o => o.id !== id));
      adminToast("Pedido eliminado.");
    } catch (e) {
      adminToast("No se pudo eliminar: " + e.message, true);
    }
  };
  var handleToggleHidden = async (id, hidden) => {
    try {
      await window.VETA_DB.toggleOrderHidden(id, hidden);
      setOrders(prev => prev.map(o => o.id === id ? {
        ...o,
        hidden
      } : o));
      adminToast(hidden ? "Pedido ocultado." : "Pedido visible.");
    } catch (e) {
      adminToast("No se pudo cambiar: " + e.message, true);
    }
  };
  var counts = useMemo(() => {
    var c = {
      active: 0,
      pending: 0,
      dispatched: 0,
      delivered: 0,
      problem: 0,
      hidden: 0,
      todos: 0
    };
    orders.forEach(o => {
      c.todos++;
      if (o.hidden) {
        c.hidden++;
        return;
      }
      if (o.status === "pending") {
        c.active++;
        c.pending++;
      }
      if (o.status === "dispatched") {
        c.active++;
        c.dispatched++;
      }
      if (o.status === "delivered") c.delivered++;
      if (o.status === "problem") c.problem++;
    });
    return c;
  }, [orders]);
  var filtered = useMemo(() => orders.filter(o => {
    if (filter === "todos") {/* mostrar todo */} else if (filter === "hidden") {
      if (!o.hidden) return false;
    } else {
      if (o.hidden) return false;
      if (filter === "active") {
        if (o.status !== "pending" && o.status !== "dispatched") return false;
      } else {
        if (o.status !== filter) return false;
      }
    }
    if (q) {
      var hay = (o.customer_name || "") + " " + o.phone + " " + (o.city || "");
      if (!hay.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  }), [orders, filter, q]);
  var FILTER_OPTS = [["active", "Activos"], ["pending", "Pendientes"], ["dispatched", "Despachados"], ["delivered", "Entregados"], ["problem", "⚠ Peligro"], ["hidden", "Ocultos"], ["todos", "Todos los pedidos"]];
  return /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-toolbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-filters"
  }, FILTER_OPTS.map(([id, label]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    className: `adm-desp-chip${filter === id ? " adm-desp-chip--on" : ""}${id === "problem" ? " adm-desp-chip--warn" : ""}${id === "hidden" ? " adm-desp-chip--muted" : ""}`,
    onClick: () => setFilter(id)
  }, label, counts[id] > 0 && /*#__PURE__*/React.createElement("span", {
    className: "adm-desp-chip-count"
  }, counts[id])))), /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-toolbar-right"
  }, /*#__PURE__*/React.createElement("input", {
    className: "adm-input adm-desp-search",
    placeholder: "Buscar\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: "adm-desp-reload",
    onClick: load,
    disabled: loading,
    title: "Actualizar"
  }, "\u21BA"))), loading ? /*#__PURE__*/React.createElement("p", {
    className: "adm-desp-empty"
  }, "Cargando pedidos\u2026") : filtered.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "adm-desp-empty"
  }, filter === "active" ? "No hay pedidos activos." : "No hay pedidos con este estado.") : /*#__PURE__*/React.createElement("div", {
    className: "adm-desp-list"
  }, filtered.map(o => /*#__PURE__*/React.createElement(OrderCard, {
    key: o.id,
    order: o,
    onStatusChange: handleStatusChange,
    onNotesSave: handleNotesSave,
    onDeliveryNotesSave: handleDeliveryNotesSave,
    onDelete: handleDelete,
    onToggleHidden: handleToggleHidden
  }))));
}

// ── Shell con sidebar ─────────────────────────────────────
var ADMIN_TABS = [{
  id: "inicio",
  label: "Inicio",
  desc: "Resumen general",
  icon: "▦"
}, {
  id: "chats",
  label: "Chats",
  desc: "Mensajes de clientes",
  icon: "✉"
}, {
  id: "despachos",
  label: "Despachos",
  desc: "Pedidos y envíos",
  icon: "⬡"
}, {
  id: "productos",
  label: "Productos",
  desc: "Catálogo y visibilidad",
  icon: "◈"
}, {
  id: "stock",
  label: "Stock",
  desc: "Inventario por talla",
  icon: "◫"
}, {
  id: "descuentos",
  label: "Descuentos",
  desc: "Códigos promocionales",
  icon: "◎"
}, {
  id: "config",
  label: "Config.",
  desc: "Ajustes del sistema",
  icon: "◉"
}];
function AdminShell({
  onLogout
}) {
  var [tab, setTab] = useState("inicio");
  var [menuOpen, setMenuOpen] = useState(false);
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
  var chatBadge = useChatBadge();
  var despBadge = useDespBadge();

  // Bloquear scroll del body cuando el menú está abierto
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Cerrar con Escape
  useEffect(() => {
    if (!menuOpen) return;
    var onKey = e => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  var goTab = id => {
    setTab(id);
    setMenuOpen(false);
  };
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
  }, t.label, t.id === "chats" && chatBadge > 0 && /*#__PURE__*/React.createElement("span", {
    className: "adm-sb-badge-count"
  }, chatBadge), t.id === "despachos" && despBadge > 0 && /*#__PURE__*/React.createElement("span", {
    className: "adm-sb-badge-count"
  }, despBadge)))), /*#__PURE__*/React.createElement("div", {
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
    className: `adm-body${tab === "chats" ? " adm-body--chat" : ""}`
  }, /*#__PURE__*/React.createElement("header", {
    className: "adm-hdr"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "adm-hdr-title"
  }, ADMIN_TABS.find(t => t.id === tab)?.label), /*#__PURE__*/React.createElement("span", {
    className: "adm-hdr-meta"
  }, "VETA \xB7 Panel en la nube"), /*#__PURE__*/React.createElement("div", {
    className: "adm-hdr-tab-nav"
  }, /*#__PURE__*/React.createElement("select", {
    className: "adm-hdr-tab-select",
    value: tab,
    onChange: e => goTab(e.target.value),
    "aria-label": "Navegar entre secciones"
  }, ADMIN_TABS.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.id,
    value: t.id
  }, t.icon, " ", t.label))), /*#__PURE__*/React.createElement("span", {
    className: "adm-hdr-tab-chevron",
    "aria-hidden": "true"
  }, "\u25BE")), /*#__PURE__*/React.createElement("button", {
    className: "adm-hdr-hamburger",
    onClick: () => setMenuOpen(o => !o),
    "aria-label": menuOpen ? "Cerrar menú" : "Abrir menú",
    "aria-expanded": menuOpen
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-hdr-hamburger-icon",
    "data-open": menuOpen ? "1" : "0"
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null)))), /*#__PURE__*/React.createElement("div", {
    className: "adm-content"
  }, tab === "inicio" && /*#__PURE__*/React.createElement(TabInicio, {
    products: products,
    stock: stock
  }), tab === "chats" && /*#__PURE__*/React.createElement(TabChats, null), tab === "despachos" && /*#__PURE__*/React.createElement(TabDespachos, null), tab === "productos" && /*#__PURE__*/React.createElement(TabProductos, {
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
  }), tab === "descuentos" && /*#__PURE__*/React.createElement(TabDescuentos, null), tab === "config" && /*#__PURE__*/React.createElement(TabConfig, {
    cfg: cfg,
    save: saveCfg,
    onLogout: onLogout,
    resetProducts: resetToSeed
  }))), /*#__PURE__*/React.createElement("div", {
    className: "adm-mob-menu",
    "data-on": menuOpen ? "1" : "0",
    "aria-hidden": !menuOpen
  }, /*#__PURE__*/React.createElement("div", {
    className: "adm-mob-menu-hdr"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-mob-menu-brand"
  }, "VETA"), /*#__PURE__*/React.createElement("span", {
    className: "adm-mob-menu-section"
  }, "Panel de administraci\xF3n")), /*#__PURE__*/React.createElement("nav", {
    className: "adm-mob-menu-nav"
  }, ADMIN_TABS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    className: `adm-mob-menu-link${tab === t.id ? " adm-mob-menu-link--on" : ""}`,
    onClick: () => goTab(t.id),
    tabIndex: menuOpen ? 0 : -1
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-mob-menu-icon"
  }, t.icon), /*#__PURE__*/React.createElement("span", {
    className: "adm-mob-menu-text"
  }, /*#__PURE__*/React.createElement("span", {
    className: "adm-mob-menu-label"
  }, t.label), /*#__PURE__*/React.createElement("span", {
    className: "adm-mob-menu-desc"
  }, t.desc)), t.id === "chats" && chatBadge > 0 && /*#__PURE__*/React.createElement("span", {
    className: "adm-mob-menu-badge"
  }, chatBadge), t.id === "despachos" && despBadge > 0 && /*#__PURE__*/React.createElement("span", {
    className: "adm-mob-menu-badge"
  }, despBadge), tab === t.id && /*#__PURE__*/React.createElement("span", {
    className: "adm-mob-menu-active-dot"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "adm-mob-menu-foot"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#home",
    className: "adm-sb-link",
    onClick: () => setMenuOpen(false)
  }, "\u2190 Ver tienda"), /*#__PURE__*/React.createElement("button", {
    className: "adm-sb-link",
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0
    },
    onClick: onLogout,
    tabIndex: menuOpen ? 0 : -1
  }, "Cerrar sesi\xF3n"))));
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
