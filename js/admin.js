/* VETA · Panel de administración — Prototipo localStorage
   Para producción: migrar a Supabase u otro backend.      */

var {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo
} = React;

// ── Storage keys ──────────────────────────────────────────
var ADM = {
  hash: "veta-admin-hash",
  session: "veta-admin-session",
  stock: "veta-stock",
  hidden: "veta-hidden",
  settings: "veta-adm-cfg",
  products: "veta-products" // lista de productos (override del catálogo)
};
var DEFAULT_PW = "veta2026";

// ── Helpers ───────────────────────────────────────────────
async function sha256(msg) {
  var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function rd(key, fb = null) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fb;
  } catch {
    return fb;
  }
}
function wr(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// Seed inicial: agrega campo images a los productos de data.js
function seedProducts() {
  return VETA_DATA.products.map(p => ({
    ...p,
    images: p.images || {}
  }));
}

// ── API pública (utilizada por el sitio público) ──────────
window.VETA_ADMIN = {
  getProducts() {
    try {
      var stored = localStorage.getItem(ADM.products);
      if (stored) return JSON.parse(stored);
    } catch {}
    return VETA_DATA.products;
  },
  getStock(pid, sz) {
    var v = rd(ADM.stock, {})[`${pid}::${sz}`];
    return v === undefined ? null : v;
  },
  isHidden(pid) {
    return rd(ADM.hidden, []).includes(pid);
  }
};

// ── Auth ──────────────────────────────────────────────────
async function ensurePw() {
  var stored = localStorage.getItem(ADM.hash);
  if (stored && stored.startsWith('"')) {
    stored = JSON.parse(stored);
    localStorage.setItem(ADM.hash, stored);
  }
  if (!stored) localStorage.setItem(ADM.hash, await sha256(DEFAULT_PW));
}
function useAuth() {
  var [authed, setAuthed] = useState(() => !!sessionStorage.getItem(ADM.session));
  var [loading, setLoading] = useState(false);
  var [err, setErr] = useState("");
  var login = useCallback(async pw => {
    setLoading(true);
    setErr("");
    try {
      await ensurePw();
      var hash = await sha256(pw);
      if (hash === localStorage.getItem(ADM.hash)) {
        sessionStorage.setItem(ADM.session, typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now().toString(36));
        setAuthed(true);
      } else setErr("Contraseña incorrecta.");
    } catch {
      setErr("Error de verificación. Intenta de nuevo.");
    }
    setLoading(false);
  }, []);
  var logout = useCallback(() => {
    sessionStorage.removeItem(ADM.session);
    setAuthed(false);
  }, []);
  return {
    authed,
    loading,
    err,
    login,
    logout
  };
}

// ── Data hooks ────────────────────────────────────────────
function useProductCRUD() {
  var [products, setProducts] = useState(() => {
    // Supabase data si ya cargó, si no localStorage/seed
    if (window.VETA_DB) {
      var sp = window.VETA_DB.getProducts();
      if (sp && sp.length) return sp;
    }
    try {
      var stored = localStorage.getItem(ADM.products);
      if (stored) return JSON.parse(stored);
    } catch {}
    return seedProducts();
  });
  var persist = list => {
    try {
      localStorage.setItem(ADM.products, JSON.stringify(list));
      setProducts(list);
    } catch (e) {
      if (e.name === "QuotaExceededError") alert("Almacenamiento lleno. Usa URLs de imágenes en lugar de archivos locales.");
    }
  };
  var add = useCallback(p => {
    persist([...products, p]);
    window.VETA_DB?.upsertProduct(p).catch(e => console.warn("[Admin] upsertProduct:", e));
  }, [products]);
  var update = useCallback((id, data) => {
    var updated = products.map(p => p.id === id ? {
      ...p,
      ...data
    } : p);
    persist(updated);
    var full = updated.find(p => p.id === id);
    if (full) window.VETA_DB?.upsertProduct(full).catch(e => console.warn("[Admin] upsertProduct:", e));
  }, [products]);
  var remove = useCallback(id => {
    persist(products.filter(p => p.id !== id));
    window.VETA_DB?.deleteProduct(id).catch(e => console.warn("[Admin] deleteProduct:", e));
  }, [products]);
  var generateId = useCallback(cat => {
    var pfx = {
      anillos: "an",
      collares: "co",
      aretes: "ar",
      pulseras: "pu",
      piercings: "pi"
    }[cat] || "prod";
    var nums = products.filter(p => p.id.startsWith(pfx + "-")).map(p => {
      var n = parseInt(p.id.split("-")[1], 10);
      return isNaN(n) ? 0 : n;
    });
    var next = nums.length ? Math.max(...nums) + 1 : 1;
    return `${pfx}-${String(next).padStart(2, "0")}`;
  }, [products]);
  var resetToSeed = useCallback(() => {
    persist(seedProducts());
  }, []);
  return {
    products,
    add,
    update,
    remove,
    generateId,
    resetToSeed
  };
}
function useHidden() {
  var [hidden, setHiddenRaw] = useState(() => rd(ADM.hidden, []));
  var toggle = useCallback(id => {
    setHiddenRaw(prev => {
      var next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      wr(ADM.hidden, next);
      var visible = !next.includes(id);
      window.VETA_DB?.setVisible(id, visible).catch(e => console.warn("[Admin] setVisible:", e));
      return next;
    });
  }, []);
  return {
    hidden,
    toggle
  };
}
function useStock() {
  var [stock, setStockRaw] = useState(() => {
    // Preferir datos de Supabase si ya cargaron, si no localStorage
    var sb = window.VETA_STOCK;
    if (sb && Object.keys(sb).length > 0) return sb;
    return rd(ADM.stock, {});
  });

  // Cuando Supabase termine de cargar, sincronizar el estado local
  useEffect(() => {
    if (!window.VETA_DB) return;
    return window.VETA_DB.onReady(() => {
      var sb = window.VETA_STOCK || {};
      if (Object.keys(sb).length > 0) {
        setStockRaw(sb);
        wr(ADM.stock, sb);
      }
    });
  }, []);
  var set = useCallback((pid, sz, qty) => {
    setStockRaw(prev => {
      var k = `${pid}::${sz}`;
      var next = {
        ...prev
      };
      var finalQty = Math.max(0, qty);
      if (qty < 0) delete next[k];else next[k] = finalQty;
      wr(ADM.stock, next);
      if (qty >= 0) window.VETA_DB?.setStock(pid, sz, finalQty).catch(e => console.warn("[Admin] setStock:", e));
      return next;
    });
  }, []);
  var get = useCallback((pid, sz) => {
    var v = stock[`${pid}::${sz}`];
    return v === undefined ? "" : v;
  }, [stock]);
  var reset = useCallback(() => {
    wr(ADM.stock, {});
    setStockRaw({});
  }, []);
  return {
    stock,
    set,
    get,
    reset
  };
}
function useCfg() {
  var [cfg, setCfgRaw] = useState(() => ({
    wa_phone: "573246206702",
    ...rd(ADM.settings, {})
  }));
  var save = useCallback(patch => {
    setCfgRaw(prev => {
      var next = {
        ...prev,
        ...patch
      };
      wr(ADM.settings, next);
      // Sincronizar cada clave a la tabla settings de Supabase
      Object.entries(patch).forEach(([k, v]) => {
        window.VETA_DB?.saveSetting(k, String(v)).catch(e => console.warn("[Admin] saveSetting:", e));
      });
      return next;
    });
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
  }, /*#__PURE__*/React.createElement("strong", null, "Borrador:"), " datos en este navegador (localStorage). Para producci\xF3n migrar a Supabase."));
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
    var curHash = await sha256(cur);
    if (curHash !== localStorage.getItem(ADM.hash)) {
      setMsg({
        ok: false,
        t: "Contraseña actual incorrecta."
      });
      setBusy(false);
      return;
    }
    localStorage.setItem(ADM.hash, await sha256(nxt));
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
  var [saved, setSaved] = useState(false);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }, saved ? "Guardado ✓" : "Guardar"))), /*#__PURE__*/React.createElement("hr", {
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
  }, /*#__PURE__*/React.createElement("strong", null, "Nota:"), " Stock, visibilidad, productos y configuraci\xF3n se almacenan en este navegador (localStorage). Al migrar a Supabase, estos datos estar\xE1n disponibles desde cualquier dispositivo."));
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
    products: crudProducts,
    add,
    update,
    remove,
    resetToSeed
  } = useProductCRUD();
  var {
    hidden,
    toggle
  } = useHidden();
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
  var products = crudProducts.map(p => ({
    ...p,
    hidden: hidden.includes(p.id)
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
  }, "VETA \xB7 Panel local")), /*#__PURE__*/React.createElement("div", {
    className: "adm-content"
  }, tab === "inicio" && /*#__PURE__*/React.createElement(TabInicio, {
    products: products,
    stock: stock
  }), tab === "productos" && /*#__PURE__*/React.createElement(TabProductos, {
    products: products,
    addProduct: add,
    updateProduct: update,
    removeProduct: remove,
    toggleHidden: toggle
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
    loading,
    err,
    login,
    logout
  } = useAuth();
  if (!authed) return /*#__PURE__*/React.createElement(AdminLogin, {
    onLogin: login,
    loading: loading,
    err: err
  });
  return /*#__PURE__*/React.createElement(AdminShell, {
    onLogout: logout
  });
}
window.AdminPanel = AdminPanel;
