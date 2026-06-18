/* VETA · App raíz
   - Routing por hash
   - Cart en localStorage
   - Tweaks (paleta, animación, densidad)
   - Cart drawer + export a WhatsApp
*/

var TWEAK_DEFAULTS = {
  "theme": "dark",
  "palette": "mediterranean",
  "animation": 1,
  "density": "regular",
  "magnetic": true,
  "wa_phone": "573243147031"
};

/* Paletas — todas comparten estructura */
var PALETTES = {
  mediterranean: {
    light: {
      "--bg": "#ebe5dc",
      "--bg-elev": "#f3eee6",
      "--bg-soft": "#ded5c7",
      "--ink": "#2b231b",
      "--ink-soft": "#6b5a48",
      "--ink-faint": "#a08866",
      "--line": "rgba(43,35,27,.10)",
      "--accent": "#a08866",
      "--accent-2": "#c9b896"
    },
    dark: {
      "--bg": "#14110d",
      "--bg-elev": "#1c1814",
      "--bg-soft": "#221d18",
      "--ink": "#ebe5dc",
      "--ink-soft": "#a89884",
      "--ink-faint": "#6b5a48",
      "--line": "rgba(235,229,220,.08)",
      "--accent": "#c9a978",
      "--accent-2": "#8a7253"
    }
  },
  porcelain: {
    light: {
      "--bg": "#f6f4ef",
      "--bg-elev": "#ffffff",
      "--bg-soft": "#e9e6df",
      "--ink": "#1a1a1a",
      "--ink-soft": "#5a5a5a",
      "--ink-faint": "#9a9a9a",
      "--line": "rgba(26,26,26,.10)",
      "--accent": "#b8956a",
      "--accent-2": "#d4af37"
    },
    dark: {
      "--bg": "#0f0f0f",
      "--bg-elev": "#181818",
      "--bg-soft": "#1f1f1f",
      "--ink": "#f6f4ef",
      "--ink-soft": "#9a9a9a",
      "--ink-faint": "#5a5a5a",
      "--line": "rgba(246,244,239,.08)",
      "--accent": "#d4af37",
      "--accent-2": "#8a7253"
    }
  },
  obsidian: {
    light: {
      "--bg": "#e8e6e1",
      "--bg-elev": "#f1efea",
      "--bg-soft": "#d6d3cb",
      "--ink": "#0a0a0a",
      "--ink-soft": "#525252",
      "--ink-faint": "#8a8a8a",
      "--line": "rgba(10,10,10,.10)",
      "--accent": "#3d342d",
      "--accent-2": "#8b7355"
    },
    dark: {
      "--bg": "#0a0a0a",
      "--bg-elev": "#141414",
      "--bg-soft": "#1a1a1a",
      "--ink": "#e8e6e1",
      "--ink-soft": "#9a9a9a",
      "--ink-faint": "#5a5a5a",
      "--line": "rgba(232,230,225,.08)",
      "--accent": "#b8956a",
      "--accent-2": "#6b5a48"
    }
  }
};
function applyPalette(name, theme) {
  var p = (PALETTES[name] || PALETTES.mediterranean)[theme] || PALETTES.mediterranean.light;
  var root = document.documentElement;
  Object.entries(p).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-theme", theme);
}

/* ─────────────────────────────────────────────
   Hash routing
   #home  |  #catalog  |  #catalog/anillos  |  #pdp/an-01  |  #care
   ───────────────────────────────────────────── */
function parseHash() {
  var raw = (location.hash || "#home").replace(/^#/, "");
  var [path, qs] = raw.split("?");
  var [name, arg] = path.split("/");
  var r = {
    name: name || "home"
  };
  if (name === "catalog" && arg) r.filter = arg;
  if (name === "pdp" && arg) r.id = arg;
  if (qs) {
    var p = new URLSearchParams(qs);
    if (p.has("q")) r.search = p.get("q");
  }
  return r;
}
function setHash(r) {
  var h = "#" + r.name;
  if (r.name === "catalog" && r.filter) h += "/" + r.filter;
  if (r.name === "pdp" && r.id) h += "/" + r.id;
  if (r.search) h += "?" + new URLSearchParams({
    q: r.search
  }).toString();
  if (location.hash !== h) location.hash = h;
}

/* ─────────────────────────────────────────────
   Cart hook
   ───────────────────────────────────────────── */
function useCart() {
  var [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("veta-cart") || "[]");
    } catch {
      return [];
    }
  });
  var [appliedCode, setAppliedCode] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("veta-discount") || "null");
    } catch {
      return null;
    }
  });
  var [codeError, setCodeError] = useState("");
  var [codeLoading, setCodeLoading] = useState(false);
  useEffect(() => {
    localStorage.setItem("veta-cart", JSON.stringify(items));
  }, [items]);
  useEffect(() => {
    localStorage.setItem("veta-discount", JSON.stringify(appliedCode));
  }, [appliedCode]);
  var add = useCallback((product, opts) => {
    setItems(prev => {
      var key = `${product.id}::${opts.size}::${opts.finish}`;
      var idx = prev.findIndex(it => it.key === key);
      var cur = idx >= 0 ? prev[idx].qty : 0;
      var req = opts.qty || 1;
      var stock = window.VETA_DB?.getStock(product.id, opts.size) ?? window.VETA_ADMIN?.getStock(product.id, opts.size);
      var cap = stock !== null && stock !== undefined ? stock : Infinity;
      var newQty = Math.min(cur + req, cap);
      if (newQty <= 0) return prev;
      if (idx >= 0) {
        if (newQty === prev[idx].qty) return prev;
        var next = [...prev];
        next[idx] = {
          ...next[idx],
          qty: newQty
        };
        return next;
      }
      return [...prev, {
        key,
        id: product.id,
        name: product.name,
        price: product.price,
        material: product.material,
        size: opts.size,
        finish: opts.finish,
        qty: newQty,
        img: product.images?.main || null,
        shape: VETA_DATA.shapes[product.cat]?.kind || "ring"
      }];
    });
  }, []);
  var remove = useCallback(key => setItems(prev => prev.filter(it => it.key !== key)), []);
  var setQty = useCallback((key, qty) => setItems(prev => {
    if (qty <= 0) return prev.filter(it => it.key !== key);
    var item = prev.find(it => it.key === key);
    if (!item) return prev;
    var stock = window.VETA_DB?.getStock(item.id, item.size) ?? window.VETA_ADMIN?.getStock(item.id, item.size);
    var cap = stock !== null && stock !== undefined ? stock : Infinity;
    return prev.map(it => it.key === key ? {
      ...it,
      qty: Math.min(qty, cap)
    } : it);
  }), []);
  var clear = useCallback(() => {
    setItems([]);
    setAppliedCode(null);
    setCodeError("");
  }, []);
  var count = items.reduce((a, it) => a + it.qty, 0);
  var subtotal = items.reduce((a, it) => a + it.qty * it.price, 0);
  var discountAmount = useMemo(() => {
    if (!appliedCode || subtotal <= 0) return 0;
    if (appliedCode.type === "percent") return Math.round(subtotal * appliedCode.value / 100);
    return Math.min(Number(appliedCode.value), subtotal);
  }, [appliedCode, subtotal]);
  var total = subtotal - discountAmount;
  var applyCode = async code => {
    var trimmed = (code || "").trim();
    if (!trimmed) return false;
    setCodeLoading(true);
    setCodeError("");
    try {
      if (!window.VETA_DB) {
        setCodeError("No se pudo conectar. Intenta de nuevo.");
        return false;
      }
      var result = await window.VETA_DB.validateCode(trimmed, subtotal);
      if (result.valid) {
        setAppliedCode({
          code: result.code,
          type: result.type,
          value: result.value,
          description: result.description
        });
        return true;
      } else {
        setCodeError(result.reason || "Código no válido.");
        return false;
      }
    } catch {
      setCodeError("No se pudo verificar el código.");
      return false;
    } finally {
      setCodeLoading(false);
    }
  };
  var removeCode = useCallback(() => {
    setAppliedCode(null);
    setCodeError("");
  }, []);
  return {
    items,
    add,
    remove,
    setQty,
    clear,
    count,
    subtotal,
    discountAmount,
    total,
    appliedCode,
    applyCode,
    removeCode,
    codeError,
    codeLoading
  };
}

/* ─────────────────────────────────────────────
   Cart Drawer
   ───────────────────────────────────────────── */
function CartCoupon({
  cart
}) {
  var [input, setInput] = useState("");
  var handleApply = async () => {
    var ok = await cart.applyCode(input);
    if (ok) setInput("");
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "cart-coupon"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cart-coupon-label"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "7",
    y1: "7",
    x2: "7.01",
    y2: "7"
  })), "C\xF3digo de descuento"), cart.appliedCode ? /*#__PURE__*/React.createElement("div", {
    className: "cart-coupon-applied"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cart-coupon-badge"
  }, cart.appliedCode.code, " · ", cart.appliedCode.type === "percent" ? `${cart.appliedCode.value}% OFF` : `${VETA_DATA.fmtPrice(cart.appliedCode.value)} OFF`), /*#__PURE__*/React.createElement("button", {
    className: "cart-coupon-remove",
    onClick: cart.removeCode,
    "aria-label": "Quitar c\xF3digo"
  }, "\u2715 Quitar")) : /*#__PURE__*/React.createElement("div", {
    className: "cart-coupon-row"
  }, /*#__PURE__*/React.createElement("input", {
    className: "cart-coupon-input",
    placeholder: "VETAINAUGURACI\xD3N",
    value: input,
    onChange: e => setInput(e.target.value.toUpperCase()),
    onKeyDown: e => e.key === "Enter" && !cart.codeLoading && input.trim() && handleApply(),
    "aria-label": "C\xF3digo de descuento"
  }), /*#__PURE__*/React.createElement("button", {
    className: "cart-coupon-btn",
    onClick: handleApply,
    disabled: !input.trim() || cart.codeLoading
  }, cart.codeLoading ? "…" : "Aplicar")), cart.codeError && /*#__PURE__*/React.createElement("p", {
    className: "cart-coupon-error"
  }, cart.codeError));
}
function CartDrawer({
  open,
  onClose,
  cart,
  waPhone
}) {
  useEffect(() => {
    if (!open) return;
    var onKey = e => e.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  var toWhatsApp = () => {
    if (cart.items.length === 0) return;
    var lines = cart.items.map(it => `• ${it.name} (${it.material}, ${it.finish}, talla ${it.size}) x${it.qty} — ${VETA_DATA.fmtPrice(it.price * it.qty)} COP`);
    var discLines = cart.appliedCode && cart.discountAmount > 0 ? [`Código de descuento: ${cart.appliedCode.code} (${cart.appliedCode.type === "percent" ? cart.appliedCode.value + "%" : VETA_DATA.fmtPrice(cart.appliedCode.value)} OFF)`, `Descuento: -${VETA_DATA.fmtPrice(cart.discountAmount)} COP`] : [];
    var msg = ["Hola VETA, me interesa esta selección:", "", ...lines, "", `Subtotal: ${VETA_DATA.fmtPrice(cart.subtotal)} COP`, ...discLines, `Total estimado: ${VETA_DATA.fmtPrice(cart.total)} COP`, "", "¿Me confirman disponibilidad y envío?"].join("\n");
    if (cart.appliedCode) {
      try {
        window.VETA_DB?.incrementCodeUses(cart.appliedCode.code);
      } catch {}
    }
    var url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "cart-scrim",
    "data-on": open ? "1" : "0",
    onClick: onClose
  }), /*#__PURE__*/React.createElement("aside", {
    className: "cart-drawer",
    "data-on": open ? "1" : "0",
    "aria-hidden": !open
  }, /*#__PURE__*/React.createElement("header", {
    className: "cart-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Tu bolsa"), /*#__PURE__*/React.createElement("button", {
    className: "cart-close",
    onClick: onClose,
    "aria-label": "Cerrar"
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "cart-body"
  }, cart.items.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "cart-empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      fontWeight: 300,
      fontStyle: "italic",
      color: "var(--ink)"
    }
  }, "A\xFAn sin piezas."), /*#__PURE__*/React.createElement("p", {
    className: "body",
    style: {
      maxWidth: 30,
      minWidth: 240
    }
  }, "Las elecciones aparecer\xE1n aqu\xED antes de pasar a WhatsApp."), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--ghost",
    onClick: () => {
      onClose();
      location.hash = "catalog";
    },
    style: {
      marginTop: 16
    }
  }, "Explorar cat\xE1logo")) : cart.items.map(it => {
    var st = getStockStatus(it.id, it.size);
    var atLimit = st.qty !== null && it.qty >= st.qty;
    return /*#__PURE__*/React.createElement("div", {
      key: it.key,
      className: `cart-item${st.status === "out" ? " cart-item--out" : ""}`
    }, /*#__PURE__*/React.createElement(Placeholder, {
      shape: it.shape,
      tag: it.id.toUpperCase(),
      img: it.img || undefined
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, it.name), /*#__PURE__*/React.createElement("div", {
      className: "vmeta"
    }, it.material, " \xB7 ", it.finish, " \xB7 Talla ", it.size), st.status === "low" && /*#__PURE__*/React.createElement("span", {
      className: "cart-stock-badge cart-stock-badge--low"
    }, "Solo quedan ", st.qty), st.status === "out" && /*#__PURE__*/React.createElement("span", {
      className: "cart-stock-badge cart-stock-badge--out"
    }, "Agotado \u2014 quitar del pedido"), /*#__PURE__*/React.createElement("div", {
      className: "cart-qty"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => cart.setQty(it.key, it.qty - 1),
      "aria-label": "Menos"
    }, "\u2212"), /*#__PURE__*/React.createElement("span", null, it.qty), /*#__PURE__*/React.createElement("button", {
      onClick: () => cart.setQty(it.key, it.qty + 1),
      disabled: atLimit || st.status === "out",
      "aria-label": "M\xE1s"
    }, "+"))), /*#__PURE__*/React.createElement("div", {
      className: "cart-item-side"
    }, /*#__PURE__*/React.createElement("span", {
      className: "price"
    }, VETA_DATA.fmtPrice(it.price * it.qty)), /*#__PURE__*/React.createElement("button", {
      className: "remove",
      onClick: () => cart.remove(it.key)
    }, "Quitar")));
  })), cart.items.length > 0 && /*#__PURE__*/React.createElement("footer", {
    className: "cart-foot"
  }, /*#__PURE__*/React.createElement(CartCoupon, {
    cart: cart
  }), /*#__PURE__*/React.createElement("div", {
    className: "cart-totals"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("span", null, "Subtotal"), /*#__PURE__*/React.createElement("span", null, VETA_DATA.fmtPrice(cart.subtotal), " COP")), cart.discountAmount > 0 && /*#__PURE__*/React.createElement("div", {
    className: "row cart-discount-row"
  }, /*#__PURE__*/React.createElement("span", null, "Descuento (", cart.appliedCode.code, ")"), /*#__PURE__*/React.createElement("span", {
    className: "cart-discount-amount"
  }, "\u2212", VETA_DATA.fmtPrice(cart.discountAmount), " COP")), /*#__PURE__*/React.createElement("div", {
    className: "row"
  }, /*#__PURE__*/React.createElement("span", null, "Env\xEDo"), /*#__PURE__*/React.createElement("span", null, "Se confirma por WhatsApp")), /*#__PURE__*/React.createElement("div", {
    className: "row total"
  }, /*#__PURE__*/React.createElement("span", null, "Total estimado"), /*#__PURE__*/React.createElement("span", null, VETA_DATA.fmtPrice(cart.total), " COP"))), /*#__PURE__*/React.createElement(Magnetic, {
    strength: 0.1
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-wa",
    style: {
      width: "100%"
    },
    onClick: toWhatsApp
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "currentColor",
    style: {
      verticalAlign: "middle",
      marginRight: 2
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20.5 3.5A11 11 0 0 0 3.4 17.6L2 22l4.5-1.4a11 11 0 0 0 5.5 1.5h0a11 11 0 0 0 11-11 11 11 0 0 0-2.5-7.6Zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-2.7.9.9-2.6-.2-.3a9 9 0 1 1 6.9 3.4Zm5-6.7c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.6.1a7 7 0 0 1-3.6-3.2c-.3-.5.3-.4.7-1.3.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.2-.6-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.4a3 3 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.7.2.2 2 3 4.7 4.2 1.7.7 2.3.8 3.1.6.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.2-.2-.5-.4Z"
  })), "Continuar por WhatsApp")), /*#__PURE__*/React.createElement("p", {
    className: "caption",
    style: {
      textAlign: "center",
      margin: 0
    }
  }, "Concretamos la venta y el env\xEDo contigo, persona a persona."))));
}

/* ─────────────────────────────────────────────
   Banner de promoción (código público)
   ───────────────────────────────────────────── */
function SitePromoBanner({
  onOpenCart
}) {
  var [promo, setPromo] = useState(() => window.VETA_DB ? window.VETA_DB.getPublicPromoCode() : null);
  useEffect(() => {
    if (!window.VETA_DB) return;
    var unsub = window.VETA_DB.subscribe(() => setPromo(window.VETA_DB.getPublicPromoCode()));
    return unsub;
  }, []);
  if (!promo) return null;
  var label = promo.type === "percent" ? `${promo.value}% de descuento` : `${VETA_DATA.fmtPrice(promo.value)} de descuento`;
  var qualifier = promo.min_subtotal > 0 ? `en compras mayores a ${VETA_DATA.fmtPrice(promo.min_subtotal)}` : "en tus compras";
  return /*#__PURE__*/React.createElement("div", {
    className: "site-promo-banner",
    role: "banner"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "7",
    y1: "7",
    x2: "7.01",
    y2: "7"
  })), /*#__PURE__*/React.createElement("span", null, "Con el c\xF3digo ", /*#__PURE__*/React.createElement("strong", null, promo.code), ", obtienes ", label, " ", qualifier, promo.description ? ` · ${promo.description}` : ""), /*#__PURE__*/React.createElement("button", {
    className: "site-promo-banner__cta",
    onClick: onOpenCart
  }, "Agregar al carrito \u2192"));
}

/* ─────────────────────────────────────────────
   Search overlay global
   ───────────────────────────────────────────── */
var SEARCH_HINTS = ["Anillo plata 925", "Collar fino", "Arete argolla", "Piercing acero"];
function SearchOverlay({
  open,
  onClose,
  onNavigate
}) {
  var [q, setQ] = useState("");
  var inputRef = useRef(null);
  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 60);
    document.body.style.overflow = "hidden";
    var onKey = e => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  var allProducts = useMemo(() => visibleProducts(), [open]);
  var results = useMemo(() => {
    if (!q.trim()) return [];
    return searchProducts(q, allProducts);
  }, [q, allProducts]);
  var top = results.slice(0, 6);
  var goTo = r => {
    onNavigate(r);
    onClose();
  };
  var goFull = () => {
    if (q.trim()) goTo({
      name: "catalog",
      search: q.trim()
    });
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: `search-scrim${open ? " search-scrim--on" : ""}`,
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: `search-panel${open ? " search-panel--on" : ""}`,
    role: "dialog",
    "aria-label": "B\xFAsqueda",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "search-input-row"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    width: "18",
    height: "18",
    className: "search-icon",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.5-4.5"
  })), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    className: "search-field",
    value: q,
    onChange: e => setQ(e.target.value),
    onKeyDown: e => e.key === "Enter" && goFull(),
    placeholder: "Busca por nombre, material, categor\xEDa\u2026",
    "aria-label": "Buscar productos"
  }), q && /*#__PURE__*/React.createElement("button", {
    className: "search-clear",
    onClick: () => {
      setQ("");
      inputRef.current?.focus();
    },
    "aria-label": "Limpiar"
  }, "\xD7"), /*#__PURE__*/React.createElement("button", {
    className: "search-close-btn",
    onClick: onClose,
    "aria-label": "Cerrar"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    width: "17",
    height: "17",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  })))), q.trim() ? /*#__PURE__*/React.createElement("div", {
    className: "search-results-panel"
  }, top.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "search-empty"
  }, /*#__PURE__*/React.createElement("p", null, "Sin resultados para ", /*#__PURE__*/React.createElement("em", null, "\"", q, "\""), "."), /*#__PURE__*/React.createElement("button", {
    className: "search-browse-btn",
    onClick: () => goTo({
      name: "catalog"
    })
  }, "Ver todo el cat\xE1logo \u2192")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "search-count"
  }, results.length, " ", results.length === 1 ? "resultado" : "resultados"), /*#__PURE__*/React.createElement("div", {
    className: "search-results-list"
  }, top.map(p => {
    var cat = VETA_DATA.categories.find(c => c.id === p.cat);
    var shape = VETA_DATA.shapes[p.cat]?.kind || "ring";
    return /*#__PURE__*/React.createElement("button", {
      key: p.id,
      className: "search-result-item",
      onClick: () => goTo({
        name: "pdp",
        id: p.id
      })
    }, /*#__PURE__*/React.createElement("div", {
      className: "search-result-thumb"
    }, p.images?.main ? /*#__PURE__*/React.createElement("img", {
      src: p.images.main,
      alt: "",
      loading: "lazy"
    }) : /*#__PURE__*/React.createElement(PHShape, {
      kind: shape
    })), /*#__PURE__*/React.createElement("div", {
      className: "search-result-body"
    }, /*#__PURE__*/React.createElement("span", {
      className: "search-result-name"
    }, p.name), /*#__PURE__*/React.createElement("span", {
      className: "search-result-meta"
    }, p.material, " \xB7 ", cat?.label)), /*#__PURE__*/React.createElement("span", {
      className: "search-result-price"
    }, VETA_DATA.fmtPrice(p.price)));
  })), results.length > 6 && /*#__PURE__*/React.createElement("button", {
    className: "search-all-btn",
    onClick: goFull
  }, "Ver todos los resultados (", results.length, ") \u2192"))) : /*#__PURE__*/React.createElement("div", {
    className: "search-hints-panel"
  }, /*#__PURE__*/React.createElement("span", {
    className: "search-hints-label"
  }, "B\xFAsquedas frecuentes"), /*#__PURE__*/React.createElement("div", {
    className: "search-hints-row"
  }, SEARCH_HINTS.map(h => /*#__PURE__*/React.createElement("button", {
    key: h,
    className: "search-hint-chip",
    onClick: () => setQ(h)
  }, h))))));
}

/* ─────────────────────────────────────────────
   App
   ───────────────────────────────────────────── */
function App() {
  var [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  var [route, setRoute] = useState(parseHash());
  var [cartOpen, setCartOpen] = useState(false);
  var [cartBump, setCartBump] = useState(false);
  var [searchOpen, setSearchOpen] = useState(false);
  var [, forceUpdate] = useState(0);
  var cart = useCart();

  // Inicializar Supabase y re-renderizar cuando los datos lleguen
  useEffect(() => {
    if (!window.VETA_DB) return;
    window.VETA_DB.init().then(() => forceUpdate(n => n + 1));
    return window.VETA_DB.onReady(() => forceUpdate(n => n + 1));
  }, []);

  /* Aplica tweaks visuales */
  useEffect(() => {
    applyPalette(t.palette, t.theme);
  }, [t.palette, t.theme]);
  useEffect(() => {
    document.documentElement.style.setProperty("--anim-scale", String(t.animation));
    document.documentElement.setAttribute("data-density", t.density);
  }, [t.animation, t.density]);

  /* Routing */
  useEffect(() => {
    var onHash = () => {
      var r = parseHash();
      setRoute(r);
      if (r.name !== "pdp") window.scrollTo({
        top: 0,
        behavior: "instant"
      });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  var navigate = useCallback(r => setHash(r), []);

  /* Agregar al carrito + abrir drawer + bump */
  var handleAdd = useCallback((product, opts) => {
    cart.add(product, opts);
    setCartBump(true);
    setTimeout(() => setCartBump(false), 700);
    setTimeout(() => setCartOpen(true), 250);
  }, [cart]);
  if (route.name === "admin") return /*#__PURE__*/React.createElement(AdminPanel, null);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Nav, {
    route: route,
    onNavigate: navigate,
    cartCount: cart.count,
    cartBump: cartBump,
    onCartOpen: () => setCartOpen(true),
    onSearchOpen: () => setSearchOpen(true),
    theme: t.theme,
    onThemeToggle: () => setTweak("theme", t.theme === "dark" ? "light" : "dark")
  }), /*#__PURE__*/React.createElement(SitePromoBanner, {
    onOpenCart: () => setCartOpen(true)
  }), route.name === "home" && /*#__PURE__*/React.createElement(Home, {
    onNavigate: navigate,
    onAdd: handleAdd
  }), route.name === "catalog" && /*#__PURE__*/React.createElement(Catalog, {
    filter: route.filter,
    search: route.search,
    onNavigate: navigate
  }), route.name === "pdp" && /*#__PURE__*/React.createElement(PDP, {
    id: route.id,
    onNavigate: navigate,
    onAdd: handleAdd
  }), route.name === "care" && /*#__PURE__*/React.createElement(Care, {
    onNavigate: navigate
  }), /*#__PURE__*/React.createElement(Footer, {
    onNavigate: navigate
  }), /*#__PURE__*/React.createElement(SearchOverlay, {
    open: searchOpen,
    onClose: () => setSearchOpen(false),
    onNavigate: navigate
  }), /*#__PURE__*/React.createElement(CartDrawer, {
    open: cartOpen,
    onClose: () => setCartOpen(false),
    cart: cart,
    waPhone: window.VETA_DB && window.VETA_DB.getSetting("wa_phone", t.wa_phone) || t.wa_phone
  }), /*#__PURE__*/React.createElement(TweaksPanel, {
    title: "Tweaks \xB7 VETA"
  }, /*#__PURE__*/React.createElement(TweakSection, {
    label: "Aspecto"
  }), /*#__PURE__*/React.createElement(TweakColor, {
    label: "Paleta",
    value: (PALETTES[t.palette] || PALETTES.mediterranean)[t.theme] ? [(PALETTES[t.palette] || PALETTES.mediterranean)[t.theme]["--bg"], (PALETTES[t.palette] || PALETTES.mediterranean)[t.theme]["--ink"], (PALETTES[t.palette] || PALETTES.mediterranean)[t.theme]["--accent"]] : ["#ebe5dc", "#2b231b", "#a08866"],
    options: [[PALETTES.mediterranean[t.theme]["--bg"], PALETTES.mediterranean[t.theme]["--ink"], PALETTES.mediterranean[t.theme]["--accent"]], [PALETTES.porcelain[t.theme]["--bg"], PALETTES.porcelain[t.theme]["--ink"], PALETTES.porcelain[t.theme]["--accent"]], [PALETTES.obsidian[t.theme]["--bg"], PALETTES.obsidian[t.theme]["--ink"], PALETTES.obsidian[t.theme]["--accent"]]],
    onChange: v => {
      var names = ["mediterranean", "porcelain", "obsidian"];
      var idx = [PALETTES.mediterranean[t.theme]["--bg"], PALETTES.porcelain[t.theme]["--bg"], PALETTES.obsidian[t.theme]["--bg"]].indexOf(v[0]);
      setTweak("palette", names[idx >= 0 ? idx : 0]);
    }
  }), /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Tono",
    value: t.theme,
    options: ["light", "dark"],
    onChange: v => setTweak("theme", v)
  }), /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Densidad",
    value: t.density,
    options: ["compact", "regular", "airy"],
    onChange: v => setTweak("density", v)
  }), /*#__PURE__*/React.createElement(TweakSection, {
    label: "Movimiento"
  }), /*#__PURE__*/React.createElement(TweakSlider, {
    label: "Intensidad",
    value: t.animation,
    min: 0,
    max: 1.6,
    step: 0.1,
    onChange: v => setTweak("animation", v)
  }), /*#__PURE__*/React.createElement(TweakSection, {
    label: "WhatsApp"
  }), /*#__PURE__*/React.createElement(TweakText, {
    label: "N\xFAmero",
    value: t.wa_phone,
    placeholder: "521234567890",
    onChange: v => setTweak("wa_phone", v.replace(/[^0-9]/g, ""))
  }), /*#__PURE__*/React.createElement(TweakSection, {
    label: "Atajos"
  }), /*#__PURE__*/React.createElement(TweakButton, {
    label: "Inicio",
    secondary: true,
    onClick: () => navigate({
      name: "home"
    })
  }), /*#__PURE__*/React.createElement(TweakButton, {
    label: "Cat\xE1logo",
    secondary: true,
    onClick: () => navigate({
      name: "catalog"
    })
  }), /*#__PURE__*/React.createElement(TweakButton, {
    label: "Ejemplo PDP",
    secondary: true,
    onClick: () => navigate({
      name: "pdp",
      id: "an-01"
    })
  }), /*#__PURE__*/React.createElement(TweakButton, {
    label: "Cuidado",
    secondary: true,
    onClick: () => navigate({
      name: "care"
    })
  }), /*#__PURE__*/React.createElement(TweakButton, {
    label: "Vaciar bolsa",
    secondary: true,
    onClick: () => cart.clear()
  })));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
