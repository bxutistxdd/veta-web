function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* VETA · componentes base
   Placeholder, Reveal, MagneticButton, SplitText, Nav, Footer, Marquee
   Cada componente expone su API por window al final. */

var {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect
} = React;

/* ─────────────────────────────────────────────
   Hook · useInView (IntersectionObserver)
   ───────────────────────────────────────────── */
function useInView(opts = {}) {
  var ref = useRef(null);
  var [inView, setInView] = useState(false);
  useEffect(() => {
    var el = ref.current;
    if (!el) return;
    var alive = true;
    var fallbackT = 0;

    // Sync check: si ya está en viewport al montar, revela inmediato.
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < vh * 0.92 && r.bottom > 0) {
      setInView(true);
      if (opts.once !== false) return () => {};
    }
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return () => {};
    }
    var obs = new IntersectionObserver(([e]) => {
      if (!alive) return;
      if (e.isIntersecting) {
        setInView(true);
        if (opts.once !== false) obs.unobserve(el);
      } else if (opts.once === false) {
        setInView(false);
      }
    }, {
      threshold: opts.threshold ?? 0.15,
      rootMargin: opts.rootMargin ?? "0px 0px -8% 0px"
    });
    obs.observe(el);
    fallbackT = setTimeout(() => {
      if (alive) setInView(true);
    }, 1200);
    return () => {
      alive = false;
      clearTimeout(fallbackT);
      obs.disconnect();
    };
  }, [opts.once, opts.threshold, opts.rootMargin]);
  return [ref, inView];
}

/* ─────────────────────────────────────────────
   Reveal — fade + translate al entrar
   ───────────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  as = "div",
  className = "",
  style,
  variant = ""
}) {
  var [ref, inView] = useInView();
  var Tag = as;
  var cls = ["reveal", variant && `reveal--${variant}`, className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement(Tag, {
    ref: ref,
    className: cls,
    "data-in": inView ? "1" : "0",
    style: {
      "--reveal-delay": `${delay}ms`,
      ...style
    }
  }, children);
}

/* ─────────────────────────────────────────────
   SplitText — anima cada carácter
   ───────────────────────────────────────────── */
function SplitText({
  text,
  charDelay = 0,
  stagger = 28,
  className = "",
  as = "span"
}) {
  var [ref, inView] = useInView();
  var Tag = as;
  var tokens = useMemo(() => {
    var words = text.split(/(\s+)/);
    var i = 0;
    return words.map((w, wi) => {
      if (/^\s+$/.test(w)) return {
        kind: "space",
        text: w,
        key: `s${wi}`
      };
      var chars = [...w].map(c => ({
        kind: "char",
        text: c,
        idx: i++
      }));
      return {
        kind: "word",
        chars,
        key: `w${wi}`
      };
    });
  }, [text]);
  return /*#__PURE__*/React.createElement(Tag, {
    ref: ref,
    className: className,
    "aria-label": text
  }, tokens.map(t => {
    if (t.kind === "space") return /*#__PURE__*/React.createElement("span", {
      key: t.key
    }, t.text);
    return /*#__PURE__*/React.createElement("span", {
      key: t.key,
      style: {
        display: "inline-block",
        whiteSpace: "nowrap"
      }
    }, t.chars.map(c => /*#__PURE__*/React.createElement("span", {
      key: c.idx,
      className: "split-char",
      "data-in": inView ? "1" : "0",
      style: {
        "--i": c.idx,
        "--char-delay": `${charDelay}ms`
      },
      "aria-hidden": "true"
    }, c.text)));
  }));
}

/* ─────────────────────────────────────────────
   MagneticButton — con gating por distancia.
   ───────────────────────────────────────────── */
function Magnetic({
  children,
  strength = 0.3,
  radius = 110,
  className = "",
  style,
  ...rest
}) {
  var ref = useRef(null);
  useEffect(() => {
    var el = ref.current;
    if (!el) return;
    // Solo activar en dispositivos con mouse real; en touch el CSS :active maneja la retroalimentación
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
    var raf = 0;
    var tx = 0,
      ty = 0,
      x = 0,
      y = 0;
    var onMove = e => {
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dx = e.clientX - cx;
      var dy = e.clientY - cy;
      var halfW = r.width / 2;
      var halfH = r.height / 2;
      var outsideX = Math.max(0, Math.abs(dx) - halfW);
      var outsideY = Math.max(0, Math.abs(dy) - halfH);
      var edgeDist = Math.hypot(outsideX, outsideY);
      if (edgeDist > radius) {
        tx = 0;
        ty = 0;
      } else {
        var fall = 1 - edgeDist / radius;
        var ease = fall * fall;
        tx = dx * strength * ease;
        ty = dy * strength * ease;
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    var loop = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      var settled = Math.abs(tx - x) < 0.05 && Math.abs(x) < 0.05 && Math.abs(ty - y) < 0.05 && Math.abs(y) < 0.05;
      if (settled) {
        raf = 0;
        el.style.transform = "translate3d(0,0,0)";
      } else raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", onMove, {
      passive: true
    });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [strength, radius]);
  return /*#__PURE__*/React.createElement("span", _extends({
    ref: ref,
    className: className,
    style: {
      display: "inline-block",
      willChange: "transform",
      ...style
    }
  }, rest), children);
}

/* ─────────────────────────────────────────────
   ProductPlaceholder — SVG monocromo con etiqueta
   ───────────────────────────────────────────── */
function PHShape({
  kind
}) {
  switch (kind) {
    case "ring":
      return /*#__PURE__*/React.createElement("svg", {
        viewBox: "0 0 400 500",
        preserveAspectRatio: "xMidYMid meet"
      }, /*#__PURE__*/React.createElement("ellipse", {
        cx: "200",
        cy: "250",
        rx: "110",
        ry: "105",
        className: "ph-shape"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "200",
        cy: "250",
        rx: "78",
        ry: "74",
        className: "ph-shape"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "200",
        cy: "245",
        rx: "95",
        ry: "20",
        className: "ph-shape fill"
      }));
    case "necklace":
      return /*#__PURE__*/React.createElement("svg", {
        viewBox: "0 0 400 500",
        preserveAspectRatio: "xMidYMid meet"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M 80 120 Q 200 320 320 120",
        className: "ph-shape"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M 90 130 Q 200 305 310 130",
        className: "ph-shape"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "200",
        y1: "295",
        x2: "200",
        y2: "365",
        className: "ph-shape"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "200",
        cy: "385",
        r: "22",
        className: "ph-shape fill"
      }));
    case "earring":
      return /*#__PURE__*/React.createElement("svg", {
        viewBox: "0 0 400 500",
        preserveAspectRatio: "xMidYMid meet"
      }, /*#__PURE__*/React.createElement("line", {
        x1: "150",
        y1: "130",
        x2: "150",
        y2: "280",
        className: "ph-shape"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "150",
        cy: "300",
        r: "14",
        className: "ph-shape fill"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "250",
        y1: "130",
        x2: "250",
        y2: "350",
        className: "ph-shape"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "250",
        cy: "370",
        r: "14",
        className: "ph-shape fill"
      }));
    case "bracelet":
      return /*#__PURE__*/React.createElement("svg", {
        viewBox: "0 0 400 500",
        preserveAspectRatio: "xMidYMid meet"
      }, /*#__PURE__*/React.createElement("ellipse", {
        cx: "200",
        cy: "250",
        rx: "140",
        ry: "110",
        className: "ph-shape"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "200",
        cy: "250",
        rx: "130",
        ry: "100",
        className: "ph-shape"
      }), /*#__PURE__*/React.createElement("ellipse", {
        cx: "200",
        cy: "200",
        rx: "140",
        ry: "20",
        className: "ph-shape fill"
      }));
    case "piercing":
      return /*#__PURE__*/React.createElement("svg", {
        viewBox: "0 0 400 500",
        preserveAspectRatio: "xMidYMid meet"
      }, /*#__PURE__*/React.createElement("circle", {
        cx: "200",
        cy: "250",
        r: "80",
        className: "ph-shape"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "200",
        cy: "170",
        r: "10",
        className: "ph-shape fill"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "200",
        cy: "330",
        r: "10",
        className: "ph-shape fill"
      }));
    default:
      return null;
  }
}
function Placeholder({
  shape = "ring",
  label,
  tag,
  ratio,
  className = "",
  style,
  img,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `ph ${img ? "ph--img" : ""} ${className}`,
    style: {
      "--ph-ratio": ratio,
      ...style
    }
  }, rest), img ? /*#__PURE__*/React.createElement("img", {
    src: img,
    alt: "",
    loading: "lazy",
    className: "ph-img"
  }) : /*#__PURE__*/React.createElement(PHShape, {
    kind: shape
  }), tag && /*#__PURE__*/React.createElement("div", {
    className: "ph-tag"
  }, tag), label && /*#__PURE__*/React.createElement("div", {
    className: "ph-label"
  }, label));
}

/* ─────────────────────────────────────────────
   Wordmark · VETA
   ───────────────────────────────────────────── */
function Wordmark({
  onClick
}) {
  return /*#__PURE__*/React.createElement("a", {
    className: "wordmark",
    href: "#",
    onClick: e => {
      e.preventDefault();
      onClick?.();
    },
    "aria-label": "VETA \xB7 inicio"
  }, "VETA");
}

/* ─────────────────────────────────────────────
   Nav
   ───────────────────────────────────────────── */
function Nav({
  route,
  onNavigate,
  cartCount,
  cartBump,
  onCartOpen,
  theme,
  onThemeToggle,
  onSearchOpen
}) {
  var [scrolled, setScrolled] = useState(false);
  var [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    var onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, {
      passive: true
    });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Cierra el menú cuando cambia la ruta */
  useEffect(() => {
    setMenuOpen(false);
  }, [route]);

  /* Bloquea scroll del body cuando el menú está abierto */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  /* Cierra con Escape */
  useEffect(() => {
    if (!menuOpen) return;
    var onKey = e => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  var links = [{
    id: "home",
    label: "Inicio"
  }, {
    id: "catalog",
    label: "Catálogo"
  }, {
    id: "care",
    label: "Cuidado"
  }];
  var isActive = id => {
    if (id === "catalog") return route.name === "catalog" || route.name === "pdp";
    return route.name === id;
  };
  var handleNav = r => {
    setMenuOpen(false);
    onNavigate(r);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("nav", {
    className: "nav",
    "data-scrolled": scrolled ? "1" : "0"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Wordmark, {
    onClick: () => handleNav({
      name: "home"
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "nav-links"
  }, links.map(l => /*#__PURE__*/React.createElement(Magnetic, {
    key: l.id,
    strength: 0.4,
    radius: 48
  }, /*#__PURE__*/React.createElement("a", {
    className: "nav-link",
    "data-active": isActive(l.id) ? "1" : "0",
    href: "#",
    onClick: e => {
      e.preventDefault();
      handleNav({
        name: l.id
      });
    }
  }, l.label)))), /*#__PURE__*/React.createElement("div", {
    className: "nav-right"
  }, /*#__PURE__*/React.createElement("button", {
    className: "theme-toggle",
    "data-theme": theme,
    onClick: onThemeToggle,
    "aria-label": theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro",
    title: theme === "dark" ? "Modo claro" : "Modo oscuro"
  }, /*#__PURE__*/React.createElement("span", {
    className: "theme-toggle-icon",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "sun",
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"
  })), /*#__PURE__*/React.createElement("svg", {
    className: "moon",
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
  })))), /*#__PURE__*/React.createElement("button", {
    className: "nav-search-btn",
    onClick: onSearchOpen,
    "aria-label": "Buscar"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    width: "17",
    height: "17",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.5-4.5"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "nav-cart-btn",
    "data-bump": cartBump ? "1" : "0",
    onClick: onCartOpen
  }, "Bolsa", /*#__PURE__*/React.createElement("span", {
    className: "nav-cart-count"
  }, cartCount)), /*#__PURE__*/React.createElement("button", {
    className: "nav-hamburger",
    onClick: () => setMenuOpen(v => !v),
    "aria-label": menuOpen ? "Cerrar menú" : "Abrir menú",
    "aria-expanded": menuOpen
  }, /*#__PURE__*/React.createElement("span", {
    className: "nav-hamburger-icon",
    "data-open": menuOpen ? "1" : "0"
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null))))), /*#__PURE__*/React.createElement("div", {
    className: "nav-mobile-menu",
    "data-on": menuOpen ? "1" : "0",
    "aria-hidden": !menuOpen,
    role: "dialog",
    "aria-label": "Men\xFA de navegaci\xF3n"
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l.id,
    className: "nav-mobile-link",
    "data-active": isActive(l.id) ? "1" : "0",
    href: "#",
    tabIndex: menuOpen ? 0 : -1,
    onClick: e => {
      e.preventDefault();
      handleNav({
        name: l.id
      });
    }
  }, l.label)), /*#__PURE__*/React.createElement("div", {
    className: "nav-mobile-footer"
  }, /*#__PURE__*/React.createElement("span", null, "VETA \xB7 2026"), /*#__PURE__*/React.createElement("span", null, "Hecho en Colombia"))));
}

/* ─────────────────────────────────────────────
   Marquee de categorías
   ───────────────────────────────────────────── */
function Marquee({
  items,
  compact = false
}) {
  var content = /*#__PURE__*/React.createElement("span", null, items.map((it, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, /*#__PURE__*/React.createElement("span", null, it), /*#__PURE__*/React.createElement("span", {
    className: "marquee-dot"
  }))));
  return /*#__PURE__*/React.createElement("div", {
    className: compact ? "marquee marquee--compact" : "marquee",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "marquee-track"
  }, content, content));
}

/* ─────────────────────────────────────────────
   Footer
   ───────────────────────────────────────────── */
function Footer({
  onNavigate
}) {
  return /*#__PURE__*/React.createElement("footer", {
    className: "footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wordmark",
    style: {
      fontSize: 16
    }
  }, "VETA"), /*#__PURE__*/React.createElement("p", {
    className: "footer-tagline"
  }, "Plata ley 925 y oro laminado, hechos a mano para acompa\xF1ar.")), /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("h4", null, "Tienda"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNavigate({
        name: "catalog",
        filter: "anillos"
      });
    }
  }, "Anillos"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNavigate({
        name: "catalog",
        filter: "collares"
      });
    }
  }, "Collares"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNavigate({
        name: "catalog",
        filter: "aretes"
      });
    }
  }, "Aretes"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNavigate({
        name: "catalog",
        filter: "pulseras"
      });
    }
  }, "Pulseras"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNavigate({
        name: "catalog",
        filter: "piercings"
      });
    }
  }, "Piercings")), /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("h4", null, "Marca"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNavigate({
        name: "care"
      });
    }
  }, "Cuidado de la joya"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Nuestra historia"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Garant\xEDa"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Env\xEDos")), /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("h4", null, "Contacto"), /*#__PURE__*/React.createElement("a", {
    href: "https://wa.me/573243147031",
    target: "_blank",
    rel: "noopener"
  }, "WhatsApp"), /*#__PURE__*/React.createElement("a", {
    href: "https://www.instagram.com/vetajoyeria.co/",
    target: "_blank",
    rel: "noopener"
  }, "Instagram"), /*#__PURE__*/React.createElement("a", {
    href: "mailto:veyajoyeria.coloficial@gmail.com"
  }, "veyajoyeria.coloficial@gmail.com"))), /*#__PURE__*/React.createElement("div", {
    className: "footer-bottom"
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 VETA"), /*#__PURE__*/React.createElement("span", null, "Hecho con tiempo, no con prisa.")));
}

/* ─────────────────────────────────────────────
   Stock helpers (compartidos en todo el sitio)
   ───────────────────────────────────────────── */
function getStockStatus(pid, sz) {
  // Supabase primero, fallback a admin localStorage
  var qty = window.VETA_DB ? window.VETA_DB.getStock(pid, sz) : window.VETA_ADMIN?.getStock(pid, sz) ?? null;
  if (qty === null) return {
    qty: null,
    status: "ok"
  };
  if (qty === 0) return {
    qty: 0,
    status: "out"
  };
  if (qty <= 2) return {
    qty,
    status: "low"
  };
  return {
    qty,
    status: "ok"
  };
}
function isProductSoldOut(product) {
  if (!product?.sizes?.length) return false;
  var adm = window.VETA_ADMIN;
  if (!adm) return false;
  return product.sizes.every(sz => {
    var qty = adm.getStock(product.id, sz);
    return qty !== null && qty === 0;
  });
}

/* ─────────────────────────────────────────────
   ProductCard
   ───────────────────────────────────────────── */
function ProductCard({
  product,
  onOpen,
  delay = 0
}) {
  var shape = VETA_DATA.shapes[product.cat]?.kind || "ring";
  var img = VETA_DATA.productImages(product)[0] || (window.VETA_IMG || {})[product.id];
  var soldOut = isProductSoldOut(product);
  return /*#__PURE__*/React.createElement(Reveal, {
    delay: delay
  }, /*#__PURE__*/React.createElement("button", {
    className: `product-card${soldOut ? " product-card--out" : ""}`,
    onClick: () => onOpen(product)
  }, /*#__PURE__*/React.createElement(Placeholder, {
    shape: shape,
    label: `${product.material.toLowerCase()} / ${product.finish.toLowerCase()}`,
    tag: product.id.toUpperCase(),
    img: img
  }), soldOut && /*#__PURE__*/React.createElement("span", {
    className: "product-card-soldout"
  }, "Agotado"), /*#__PURE__*/React.createElement("div", {
    className: "product-card-meta"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, product.name), /*#__PURE__*/React.createElement("span", {
    className: "product-card-sub"
  }, product.material)), /*#__PURE__*/React.createElement("span", {
    className: "price"
  }, VETA_DATA.fmtPrice(product.price)))));
}

/* ─────────────────────────────────────────────
   Expose
   ───────────────────────────────────────────── */
Object.assign(window, {
  useInView,
  Reveal,
  SplitText,
  Magnetic,
  PHShape,
  Placeholder,
  Wordmark,
  Nav,
  Marquee,
  Footer,
  ProductCard
});
