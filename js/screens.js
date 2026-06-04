/* VETA · pantallas
   Home, Catalog, PDP, Care
   Cada pantalla recibe { onNavigate, onAdd, ... } por props.
*/

/* Devuelve solo los productos visibles — Supabase primero, localStorage como fallback */
function visibleProducts() {
  if (window.VETA_DB) {
    var _all = window.VETA_DB.getProducts();
    return _all.filter(p => p.visible !== false);
  }
  var adm = window.VETA_ADMIN;
  var all = adm ? adm.getProducts() : VETA_DATA.products;
  return adm ? all.filter(p => !adm.isHidden(p.id)) : all;
}

/* ─────────────────────────────────────────────
   Búsqueda de productos
   ───────────────────────────────────────────── */
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  var dp = Array.from({
    length: b.length + 1
  }, (_, j) => j);
  for (var i = 1; i <= a.length; i++) {
    var prev = dp[0];
    dp[0] = i;
    for (var j = 1; j <= b.length; j++) {
      var tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}
function tokenMatches(token, fieldWords) {
  if (token.length <= 2) return fieldWords.some(w => w.startsWith(token));
  if (fieldWords.some(w => w.includes(token) || token.includes(w))) return true;
  if (token.length >= 4) return fieldWords.some(w => w.length >= 3 && levenshtein(token, w) <= Math.floor(token.length / 4));
  return false;
}
function searchProducts(query, products) {
  var tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return products;
  var score = p => {
    var catLabel = VETA_DATA.categories.find(c => c.id === p.cat)?.label || "";
    var raw = [p.name, p.material, p.finish, p.cat, catLabel, p.blurb, p.desc, p.id].map(norm).join(" ");
    var words = raw.split(/\s+/);
    var s = 0;
    for (var t of tokens) {
      if (raw.includes(t)) s += t.length * 3;else if (tokenMatches(t, words)) s += t.length;else return -1;
    }
    return s;
  };
  return products.map(p => ({
    p,
    s: score(p)
  })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.p);
}

/* ─────────────────────────────────────────────
   HOME
   ───────────────────────────────────────────── */
function Home({
  onNavigate,
  onAdd
}) {
  var products = visibleProducts();
  var featured = products.filter(p => ["an-01", "co-01", "ar-02", "pu-01"].includes(p.id));
  return /*#__PURE__*/React.createElement("main", {
    className: "page-enter"
  }, /*#__PURE__*/React.createElement(Marquee, {
    compact: true,
    items: ["Plata ley 925", "Oro laminado 18k", "Hecho a mano en Colombia", "Garantía de por vida", "Envíos a todo el país", "Atención por WhatsApp"]
  }), /*#__PURE__*/React.createElement(HomeHero, null), /*#__PURE__*/React.createElement(HomeCarousel, null), /*#__PURE__*/React.createElement(HomeCategories, {
    onNavigate: onNavigate
  }), /*#__PURE__*/React.createElement(HomeFeatured, {
    products: featured,
    onOpen: p => onNavigate({
      name: "pdp",
      id: p.id
    })
  }), /*#__PURE__*/React.createElement(HomeManifesto, null), /*#__PURE__*/React.createElement(HomeNumbers, null));
}
function HomeHero() {
  var heroRef = useRef(null);
  var [heroQ, setHeroQ] = useState("");
  var doSearch = () => {
    var q = heroQ.trim();
    if (q) location.hash = `catalog?q=${encodeURIComponent(q)}`;
  };
  useEffect(() => {
    var el = heroRef.current;
    if (!el) return;
    var raf = 0;
    var tx = 0,
      ty = 0;
    var onMove = e => {
      var r = el.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    var loop = () => {
      el.style.setProperty("--mx", tx.toFixed(3));
      el.style.setProperty("--my", ty.toFixed(3));
      raf = 0;
    };
    el.addEventListener("mousemove", onMove);
    return () => {
      el.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  return /*#__PURE__*/React.createElement("section", {
    className: "hero",
    ref: heroRef
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-bg",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "orb orb-1"
  }), /*#__PURE__*/React.createElement("div", {
    className: "orb orb-2"
  }), /*#__PURE__*/React.createElement("div", {
    className: "orb orb-3"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero-grain"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero-rule"
  }), /*#__PURE__*/React.createElement("svg", {
    className: "hero-mark",
    viewBox: "0 0 200 200",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "100",
    cy: "100",
    r: "96",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "0.4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "100",
    cy: "100",
    r: "72",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "0.4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "100",
    cy: "100",
    r: "48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "0.4"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "100",
    x2: "196",
    y2: "100",
    stroke: "currentColor",
    strokeWidth: "0.3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "100",
    y1: "4",
    x2: "100",
    y2: "196",
    stroke: "currentColor",
    strokeWidth: "0.3"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "hero-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow reveal",
    "data-in": "1"
  }, "\u2014 Colecci\xF3n permanente \xB7 2026"), /*#__PURE__*/React.createElement("div", {
    className: "hero-meta reveal",
    "data-in": "1"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "Plata ley 925")), /*#__PURE__*/React.createElement("div", null, "Oro laminado 18k"), /*#__PURE__*/React.createElement("div", null, "Hecho en Colombia"))), /*#__PURE__*/React.createElement("h1", {
    className: "h-display"
  }, /*#__PURE__*/React.createElement(SplitText, {
    text: "Joyer\xEDa",
    stagger: 32
  }), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("em", null, /*#__PURE__*/React.createElement(SplitText, {
    text: "que perdura",
    charDelay: 350,
    stagger: 32
  }))), /*#__PURE__*/React.createElement("div", {
    className: "hero-bottom"
  }, /*#__PURE__*/React.createElement(Reveal, {
    delay: 900
  }, /*#__PURE__*/React.createElement("p", {
    className: "hero-tagline"
  }, "Piezas pensadas para acompa\xF1ar una vida entera. Plata ley 925 y oro laminado, fundidos y pulidos a mano en talleres peque\xF1os.")), /*#__PURE__*/React.createElement(Reveal, {
    delay: 1100
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-actions"
  }, /*#__PURE__*/React.createElement(Magnetic, {
    strength: 0.22,
    radius: 140
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: () => location.hash = "catalog"
  }, "Ver cat\xE1logo")), /*#__PURE__*/React.createElement(Magnetic, {
    strength: 0.22,
    radius: 140
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn--ghost",
    onClick: () => document.getElementById("home-pin")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    })
  }, "Conoce VETA")))), /*#__PURE__*/React.createElement(Reveal, {
    delay: 1300
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-search"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-search-bar"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    width: "16",
    height: "16",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.5-4.5"
  })), /*#__PURE__*/React.createElement("input", {
    className: "hero-search-input",
    value: heroQ,
    onChange: e => setHeroQ(e.target.value),
    onKeyDown: e => e.key === "Enter" && doSearch(),
    placeholder: "Busca anillo plata, collar fino, piercing\u2026",
    "aria-label": "Buscar productos"
  }), /*#__PURE__*/React.createElement("button", {
    className: "hero-search-go",
    onClick: doSearch,
    "aria-label": "Buscar"
  }, "\u2192")), /*#__PURE__*/React.createElement("div", {
    className: "hero-search-hints"
  }, ["Anillo plata", "Collar 40cm", "Arete argolla"].map(h => /*#__PURE__*/React.createElement("button", {
    key: h,
    className: "hero-search-hint",
    onClick: () => {
      location.hash = `catalog?q=${encodeURIComponent(h)}`;
    }
  }, h))))))));
}

/* Carrusel horizontal */
function HomeCarousel() {
  var slides = [{
    eyebrow: "01 · Material",
    title: "Plata ley 925.\nNada más, nada menos.",
    body: "92.5% de plata pura. Sin aleaciones que oxiden la piel ni sustituciones invisibles. Cada pieza viene con su sello grabado al interior.",
    shape: "ring",
    tag: "VETA · 925",
    label: "pieza fundida a mano"
  }, {
    eyebrow: "02 · Proceso",
    title: "Talleres pequeños.\nManos que conoces.",
    body: "Trabajamos con un círculo cerrado de artesanos en Mompox y Bogotá. Series cortas, control de calidad pieza por pieza, sin intermediarios.",
    shape: "necklace",
    tag: "VETA · taller",
    label: "filigrana momposina"
  }, {
    eyebrow: "03 · Acompañamiento",
    title: "Una compra,\nuna comunidad.",
    body: "Cuidamos a quien nos elige: garantía de por vida sobre estructura, limpieza anual gratuita y acceso a piezas exclusivas para clientela frecuente.",
    shape: "bracelet",
    tag: "VETA · comunidad",
    label: "clientela fiel"
  }];
  var [idx, setIdx] = useState(0);
  var [paused, setPaused] = useState(false);
  var total = slides.length;
  useEffect(() => {
    if (paused) return;
    var t = setTimeout(() => setIdx(i => (i + 1) % total), 6000);
    return () => clearTimeout(t);
  }, [idx, paused, total]);
  var next = () => setIdx(i => (i + 1) % total);
  var prev = () => setIdx(i => (i - 1 + total) % total);
  return /*#__PURE__*/React.createElement("section", {
    id: "home-pin",
    className: "carousel",
    "data-paused": paused ? "1" : "0",
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: () => setPaused(false),
    "aria-roledescription": "carrusel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "carousel-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "carousel-visual"
  }, slides.map((s, i) => /*#__PURE__*/React.createElement(Placeholder, {
    key: i,
    shape: s.shape,
    tag: s.tag,
    label: s.label,
    "data-on": i === idx ? "1" : "0",
    style: {
      "--ph-ratio": "4 / 5"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "carousel-num",
    "aria-live": "polite"
  }, String(idx + 1).padStart(2, "0"), " \u2014 ", String(total).padStart(2, "0"))), /*#__PURE__*/React.createElement("div", {
    className: "carousel-copy"
  }, /*#__PURE__*/React.createElement("div", {
    className: "carousel-text-stack"
  }, slides.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "carousel-text",
    "data-on": i === idx ? "1" : "0",
    "aria-hidden": i !== idx
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, s.eyebrow), /*#__PURE__*/React.createElement("h2", {
    className: "h-1",
    style: {
      whiteSpace: "pre-line"
    }
  }, s.title), /*#__PURE__*/React.createElement("p", {
    className: "body-lg",
    style: {
      maxWidth: "42ch"
    }
  }, s.body)))), /*#__PURE__*/React.createElement("div", {
    className: "carousel-controls"
  }, /*#__PURE__*/React.createElement("button", {
    className: "carousel-arrow prev",
    onClick: prev,
    "aria-label": "Anterior"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M14 6l-6 6 6 6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "12",
    x2: "20",
    y2: "12"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "carousel-dots",
    role: "tablist"
  }, slides.map((_, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "carousel-dot",
    "data-on": i === idx ? "1" : "0",
    onClick: () => setIdx(i),
    role: "tab",
    "aria-selected": i === idx,
    "aria-label": `Ir al slide ${i + 1}`
  }))), /*#__PURE__*/React.createElement("button", {
    className: "carousel-arrow next",
    onClick: next,
    "aria-label": "Siguiente"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "12",
    x2: "16",
    y2: "12"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 6l6 6-6 6"
  })))))));
}
function CatSlot({
  cat,
  index,
  onNavigate
}) {
  var products = visibleProducts().filter(p => p.cat === cat.id).slice(0, 4);
  var shape = VETA_DATA.shapes[cat.id]?.kind || "ring";
  var [idx, setIdx] = useState(0);
  useEffect(() => {
    if (products.length <= 1) return;
    var t = setInterval(() => setIdx(i => (i + 1) % products.length), 3500);
    return () => clearInterval(t);
  }, [products.length]);
  return /*#__PURE__*/React.createElement(Reveal, {
    delay: index * 80,
    className: "cat-slot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cat-slot-carousel"
  }, products.map((p, i) => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    className: "cat-slot-slide",
    "data-on": i === idx ? "1" : "0",
    onClick: () => onNavigate({
      name: "pdp",
      id: p.id
    }),
    tabIndex: i === idx ? 0 : -1,
    "aria-hidden": i !== idx
  }, /*#__PURE__*/React.createElement(Placeholder, {
    shape: shape,
    label: p.name,
    tag: `0${i + 1}`
  }))), products.length > 1 && /*#__PURE__*/React.createElement("div", {
    className: "cat-slot-dots",
    "aria-hidden": "true"
  }, products.map((_, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "cat-slot-dot",
    "data-on": i === idx ? "1" : "0",
    onClick: e => {
      e.stopPropagation();
      setIdx(i);
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "cat-slot-footer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cat-slot-name"
  }, cat.label), /*#__PURE__*/React.createElement("button", {
    className: "btn btn--text cat-slot-link",
    onClick: () => onNavigate({
      name: "catalog",
      filter: cat.id
    })
  }, "Ver todos \u2192")));
}
function HomeCategories({
  onNavigate
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "\u2014 Categor\xEDas"), /*#__PURE__*/React.createElement("h2", {
    className: "h-1"
  }, "Cinco familias.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("em", null, "Una sola lengua."))), /*#__PURE__*/React.createElement(Reveal, null, /*#__PURE__*/React.createElement("button", {
    className: "btn btn--text",
    onClick: () => onNavigate({
      name: "catalog"
    })
  }, "Ver todo"))), /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cat-gallery"
  }, VETA_DATA.categories.map((cat, i) => /*#__PURE__*/React.createElement(CatSlot, {
    key: cat.id,
    cat: cat,
    index: i,
    onNavigate: onNavigate
  })))));
}
function HomeFeatured({
  products,
  onOpen
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "section-head section-head--center"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "\u2014 Destacados"), /*#__PURE__*/React.createElement("h2", {
    className: "h-1"
  }, "Piezas que ", /*#__PURE__*/React.createElement("em", null, "elegimos hoy.")))), /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "featured-grid"
  }, products.map((p, i) => /*#__PURE__*/React.createElement(ProductCard, {
    key: p.id,
    product: p,
    onOpen: onOpen,
    delay: i * 80
  })))));
}
function HomeManifesto() {
  return /*#__PURE__*/React.createElement("section", {
    className: "manifesto"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Reveal, null, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "\u2014 Manifiesto"), /*#__PURE__*/React.createElement("h2", {
    className: "h-1",
    style: {
      marginTop: 12
    }
  }, "La joya", /*#__PURE__*/React.createElement("br", null), "como ", /*#__PURE__*/React.createElement("em", null, "memoria.")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Reveal, {
    delay: 200
  }, /*#__PURE__*/React.createElement("p", {
    className: "body-lg",
    style: {
      marginBottom: 24
    }
  }, "Llamamos veta a la l\xEDnea de plata que recorre la roca. Es lo que queda visible cuando todo lo dem\xE1s se ha desgastado. As\xED pensamos las piezas: discretas, claras, hechas para que duren m\xE1s que nosotros.")), /*#__PURE__*/React.createElement(Reveal, {
    delay: 400
  }, /*#__PURE__*/React.createElement("p", {
    className: "body",
    style: {
      marginBottom: 32
    }
  }, "No fabricamos para una temporada. Cada referencia se queda hasta que deja de tener sentido. Probamos cierres, pulimos cantos, hablamos con quien nos compra. Vendemos pocas, atendemos a todas."))));
}
function HomeNumbers() {
  var cells = [{
    num: "925",
    label: "Pureza de plata"
  }, {
    num: "18k",
    label: "Oro laminado"
  }, {
    num: /*#__PURE__*/React.createElement(React.Fragment, null, "\u221E"),
    label: "Garantía estructura"
  }, {
    num: "00",
    label: "Intermediarios"
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "section-body",
    style: {
      paddingBottom: 120
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "numbers"
  }, cells.map((c, i) => /*#__PURE__*/React.createElement(Reveal, {
    key: i,
    delay: i * 100,
    className: "num-cell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "num"
  }, /*#__PURE__*/React.createElement("em", null, c.num)), /*#__PURE__*/React.createElement("div", {
    className: "label"
  }, c.label)))));
}

/* ─────────────────────────────────────────────
   CATÁLOGO
   ───────────────────────────────────────────── */
function Catalog({
  filter,
  search,
  onNavigate
}) {
  var all = useMemo(() => visibleProducts(), []);
  var [cat, setCat] = useState(filter || "all");
  var [mat, setMat] = useState("all");
  var [sort, setSort] = useState("default");
  var [q, setQ] = useState(search || "");
  useEffect(() => {
    setCat(filter || "all");
  }, [filter]);
  useEffect(() => {
    setQ(search || "");
  }, [search]);
  var filtered = useMemo(() => {
    var list = all;
    if (cat !== "all") list = list.filter(p => p.cat === cat);
    if (mat !== "all") list = list.filter(p => p.material === mat);
    if (q.trim()) return searchProducts(q, list);
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [all, cat, mat, q, sort]);
  return /*#__PURE__*/React.createElement("main", {
    className: "page-enter"
  }, /*#__PURE__*/React.createElement("header", {
    className: "cat-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "\u2014 Cat\xE1logo"), /*#__PURE__*/React.createElement("h1", {
    className: "h-1"
  }, cat === "all" ? /*#__PURE__*/React.createElement(React.Fragment, null, "Todas las piezas") : VETA_DATA.categories.find(c => c.id === cat)?.label)), /*#__PURE__*/React.createElement("span", {
    className: "count"
  }, String(filtered.length).padStart(2, "0"), " piezas")), /*#__PURE__*/React.createElement("div", {
    className: "filters"
  }, /*#__PURE__*/React.createElement("div", {
    className: "filters-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "catalog-search-wrap"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    width: "15",
    height: "15",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.5-4.5"
  })), /*#__PURE__*/React.createElement("input", {
    className: "catalog-search-input",
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Buscar en el cat\xE1logo\u2026",
    "aria-label": "Buscar productos"
  }), q && /*#__PURE__*/React.createElement("button", {
    className: "catalog-search-clear",
    onClick: () => setQ(""),
    "aria-label": "Limpiar"
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "filter-group"
  }, /*#__PURE__*/React.createElement("span", {
    className: "filter-group-label"
  }, "Familia"), /*#__PURE__*/React.createElement("button", {
    className: "chip",
    "data-on": cat === "all" ? "1" : "0",
    onClick: () => setCat("all")
  }, "Todas"), VETA_DATA.categories.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    className: "chip",
    "data-on": cat === c.id ? "1" : "0",
    onClick: () => setCat(c.id)
  }, c.label))), /*#__PURE__*/React.createElement("div", {
    className: "filter-group"
  }, /*#__PURE__*/React.createElement("span", {
    className: "filter-group-label"
  }, "Material"), /*#__PURE__*/React.createElement("button", {
    className: "chip",
    "data-on": mat === "all" ? "1" : "0",
    onClick: () => setMat("all")
  }, "Todos"), VETA_DATA.materials.map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    className: "chip",
    "data-on": mat === m ? "1" : "0",
    onClick: () => setMat(m)
  }, m))), /*#__PURE__*/React.createElement("div", {
    className: "filter-group",
    style: {
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "filter-group-label"
  }, "Orden"), /*#__PURE__*/React.createElement("select", {
    className: "sort-select",
    value: sort,
    onChange: e => setSort(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "default"
  }, "Sugerido"), /*#__PURE__*/React.createElement("option", {
    value: "price-asc"
  }, "Precio \xB7 menor"), /*#__PURE__*/React.createElement("option", {
    value: "price-desc"
  }, "Precio \xB7 mayor"), /*#__PURE__*/React.createElement("option", {
    value: "name"
  }, "Nombre"))))), /*#__PURE__*/React.createElement("div", {
    className: "cat-grid-products"
  }, filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "1/-1",
      padding: "80px 0",
      textAlign: "center",
      color: "var(--ink-soft)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "body"
  }, q.trim() ? `Sin resultados para "${q}". Prueba otro término o busca algo más general.` : "Sin resultados para esta combinación.")) : filtered.map((p, i) => /*#__PURE__*/React.createElement(ProductCard, {
    key: p.id,
    product: p,
    onOpen: p => onNavigate({
      name: "pdp",
      id: p.id
    }),
    delay: i % 8 * 50
  }))));
}

/* ─────────────────────────────────────────────
   PDP
   ───────────────────────────────────────────── */
function PDP({
  id,
  onNavigate,
  onAdd
}) {
  var allProducts = window.VETA_ADMIN ? window.VETA_ADMIN.getProducts() : VETA_DATA.products;
  var product = allProducts.find(p => p.id === id) || allProducts[0];
  var shape = VETA_DATA.shapes[product.cat]?.kind || "ring";
  var views = useMemo(() => [{
    tag: "01 · frontal",
    label: "vista frontal",
    imgKey: "main"
  }, {
    tag: "02 · perfil",
    label: "vista de perfil",
    imgKey: "profile"
  }, {
    tag: "03 · detalle",
    label: "detalle de acabado",
    imgKey: "detail"
  }, {
    tag: "04 · contexto",
    label: "en uso",
    imgKey: "context"
  }], []);
  var [view, setView] = useState(0);
  var [size, setSize] = useState(() => {
    var adm = window.VETA_ADMIN;
    if (!adm) return product.sizes[0];
    return product.sizes.find(sz => adm.getStock(product.id, sz) !== 0) || product.sizes[0];
  });
  var [finish, setFinish] = useState(product.finish);
  var [qty, setQty] = useState(1);

  /* Stock de la talla seleccionada */
  var stockInfo = getStockStatus(product.id, size);
  var maxQty = stockInfo.qty !== null ? stockInfo.qty : 99;
  var isOut = stockInfo.status === "out";
  var isLow = stockInfo.status === "low";

  /* Al cambiar talla: ajusta qty si supera el stock disponible */
  var handleSizeSelect = s => {
    var st = getStockStatus(product.id, s);
    setSize(s);
    if (st.qty !== null && qty > st.qty) setQty(Math.max(1, st.qty));
  };
  var [animKey, setAnimKey] = useState(0);
  useEffect(() => {
    setAnimKey(k => k + 1);
  }, [view]);
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "instant"
    });
  }, [id]);
  var related = visibleProducts().filter(p => p.cat === product.cat && p.id !== product.id).slice(0, 4);
  return /*#__PURE__*/React.createElement("main", {
    className: "page-enter"
  }, /*#__PURE__*/React.createElement("section", {
    className: "pdp"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pdp-gallery"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pdp-thumbs"
  }, views.map((v, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "pdp-thumb",
    "data-on": view === i ? "1" : "0",
    onClick: () => setView(i),
    "aria-label": `Vista ${i + 1}`
  }, /*#__PURE__*/React.createElement(Placeholder, {
    shape: shape,
    tag: v.tag.split(" ")[0],
    img: product.images?.[v.imgKey] || undefined
  })))), /*#__PURE__*/React.createElement("div", {
    className: "pdp-main-img",
    key: animKey
  }, /*#__PURE__*/React.createElement(Placeholder, {
    shape: shape,
    label: views[view].label,
    tag: `${product.id.toUpperCase()} · ${views[view].tag}`,
    ratio: "4 / 5",
    img: product.images?.[views[view].imgKey] || undefined
  }))), /*#__PURE__*/React.createElement("div", {
    className: "pdp-info"
  }, /*#__PURE__*/React.createElement(Reveal, null, /*#__PURE__*/React.createElement("div", {
    className: "pdp-cat"
  }, VETA_DATA.categories.find(c => c.id === product.cat)?.label, " \xB7 ", product.material)), /*#__PURE__*/React.createElement(Reveal, {
    delay: 100
  }, /*#__PURE__*/React.createElement("h1", {
    className: "pdp-title"
  }, product.name)), /*#__PURE__*/React.createElement(Reveal, {
    delay: 200
  }, /*#__PURE__*/React.createElement("div", {
    className: "pdp-price"
  }, VETA_DATA.fmtPrice(product.price), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "var(--ink-soft)",
      fontFamily: "var(--mono)",
      marginLeft: 8
    }
  }, "COP"))), /*#__PURE__*/React.createElement(Reveal, {
    delay: 280
  }, /*#__PURE__*/React.createElement("p", {
    className: "pdp-desc"
  }, product.desc)), /*#__PURE__*/React.createElement(Reveal, {
    delay: 360
  }, /*#__PURE__*/React.createElement("div", {
    className: "pdp-section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pdp-section-label"
  }, "Acabado"), /*#__PURE__*/React.createElement("div", {
    className: "variant-row"
  }, VETA_DATA.finishes.map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    className: "variant-chip",
    "data-on": finish === f ? "1" : "0",
    onClick: () => setFinish(f)
  }, f))))), /*#__PURE__*/React.createElement(Reveal, {
    delay: 440
  }, /*#__PURE__*/React.createElement("div", {
    className: "pdp-section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pdp-section-label"
  }, "Talla / largo"), /*#__PURE__*/React.createElement("div", {
    className: "size-row"
  }, product.sizes.map(s => {
    var st = getStockStatus(product.id, s);
    return /*#__PURE__*/React.createElement("button", {
      key: s,
      className: `size-chip${st.status === "out" ? " size-chip--out" : st.status === "low" ? " size-chip--low" : ""}`,
      "data-on": size === s ? "1" : "0",
      disabled: st.status === "out",
      onClick: () => handleSizeSelect(s)
    }, s, st.status === "low" && /*#__PURE__*/React.createElement("span", {
      className: "size-chip-badge"
    }, st.qty));
  })), (isOut || isLow) && /*#__PURE__*/React.createElement("p", {
    className: `pdp-stock-msg pdp-stock-msg--${isOut ? "out" : "low"}`
  }, isOut ? "Esta talla está agotada. Selecciona otra o escríbenos." : `Solo ${stockInfo.qty === 1 ? "queda 1 unidad" : `quedan ${stockInfo.qty} unidades`} en esta talla.`))), /*#__PURE__*/React.createElement(Reveal, {
    delay: 520
  }, /*#__PURE__*/React.createElement("div", {
    className: "pdp-section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pdp-section-label"
  }, "Cantidad"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cart-qty",
    style: {
      marginTop: 0,
      width: "fit-content"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setQty(Math.max(1, qty - 1)),
    disabled: isOut,
    "aria-label": "Menos"
  }, "\u2212"), /*#__PURE__*/React.createElement("span", null, qty), /*#__PURE__*/React.createElement("button", {
    onClick: () => setQty(Math.min(maxQty, qty + 1)),
    disabled: isOut || qty >= maxQty,
    "aria-label": "M\xE1s"
  }, "+")), stockInfo.qty !== null && !isOut && /*#__PURE__*/React.createElement("span", {
    className: "pdp-stock-avail"
  }, stockInfo.qty, " disponibles en esta talla")))), /*#__PURE__*/React.createElement(Reveal, {
    delay: 600
  }, /*#__PURE__*/React.createElement("div", {
    className: "pdp-add"
  }, /*#__PURE__*/React.createElement(Magnetic, {
    strength: 0.12,
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    style: {
      width: "100%"
    },
    disabled: isOut,
    onClick: () => !isOut && onAdd(product, {
      size,
      finish,
      qty
    })
  }, isOut ? "Talla agotada" : "Agregar a la bolsa")))), /*#__PURE__*/React.createElement(Reveal, {
    delay: 700
  }, /*#__PURE__*/React.createElement("div", {
    className: "pdp-details"
  }, /*#__PURE__*/React.createElement("details", {
    className: "detail-row",
    open: true
  }, /*#__PURE__*/React.createElement("summary", null, "Especificaci\xF3n"), /*#__PURE__*/React.createElement("p", null, "Material: ", /*#__PURE__*/React.createElement("b", null, product.material), ". Acabado: ", /*#__PURE__*/React.createElement("b", null, finish), ". Sello \"925\" grabado al interior. Cada pieza incluye estuche de tela y certificado.")), /*#__PURE__*/React.createElement("details", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("summary", null, "Env\xEDo"), /*#__PURE__*/React.createElement("p", null, "Env\xEDo gratuito en pedidos a partir de $300.000 COP. Entrega en 3\u20135 d\xEDas h\xE1biles a todo Colombia. Empaque sostenible reutilizable.")), /*#__PURE__*/React.createElement("details", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("summary", null, "Garant\xEDa"), /*#__PURE__*/React.createElement("p", null, "Garant\xEDa de por vida sobre la estructura. Limpieza profesional gratuita una vez al a\xF1o en cualquier momento.")), /*#__PURE__*/React.createElement("details", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("summary", null, "Cuidado"), /*#__PURE__*/React.createElement("p", null, "Guarda separado, evita perfumes y cremas en contacto directo. Pulir con pa\xF1o suave. ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNavigate({
        name: "care"
      });
    },
    style: {
      color: "var(--ink)",
      textDecoration: "underline",
      textDecorationThickness: "0.5px",
      textUnderlineOffset: 3
    }
  }, "Ver gu\xEDa completa \u2192"))))))), related.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "\u2014 Tambi\xE9n te puede interesar"), /*#__PURE__*/React.createElement("h2", {
    className: "h-2"
  }, "De la misma ", /*#__PURE__*/React.createElement("em", null, "familia.")))), /*#__PURE__*/React.createElement("div", {
    className: "section-body",
    style: {
      paddingBottom: 120
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "feature-row"
  }, related.map((p, i) => /*#__PURE__*/React.createElement(ProductCard, {
    key: p.id,
    product: p,
    onOpen: p => onNavigate({
      name: "pdp",
      id: p.id
    }),
    delay: i * 80
  }))))));
}

/* ─────────────────────────────────────────────
   CUIDADO
   ───────────────────────────────────────────── */
function Care() {
  var steps = [{
    n: "01",
    title: "Guarda separada",
    body: "Cada pieza en su bolsa de tela o estuche. El roce entre joyas es la primera causa de microrayas en la plata."
  }, {
    n: "02",
    title: "Última en ponerse, primera en quitarse",
    body: "Aplica perfume, crema y maquillaje antes de vestir la pieza. Quítala antes de dormir, nadar o entrenar."
  }, {
    n: "03",
    title: "Limpieza semanal suave",
    body: "Paño de microfibra seco y movimientos circulares. Para sulfuros visibles: agua tibia, jabón neutro y secado inmediato."
  }, {
    n: "04",
    title: "Oro laminado: trato extra",
    body: "Evita contacto directo con químicos. No uses pasta de dientes ni productos abrasivos: el laminado es delgado y se desgasta."
  }, {
    n: "05",
    title: "Limpieza profesional anual",
    body: "Tu pieza VETA tiene una limpieza profunda gratuita al año. Escríbenos por WhatsApp para coordinar."
  }, {
    n: "06",
    title: "Si pierde brillo",
    body: "Es normal: la plata se oxida con el aire. Una pulida con paño especializado (incluido en tu pedido) la devuelve a fábrica."
  }];
  return /*#__PURE__*/React.createElement("main", {
    className: "page-enter"
  }, /*#__PURE__*/React.createElement("section", {
    className: "care-hero"
  }, /*#__PURE__*/React.createElement(Reveal, null, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, "\u2014 Gu\xEDa")), /*#__PURE__*/React.createElement(Reveal, {
    delay: 100
  }, /*#__PURE__*/React.createElement("h1", {
    className: "h-1"
  }, "Cuidar la pieza", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("em", null, "es prolongar la historia."))), /*#__PURE__*/React.createElement(Reveal, {
    delay: 300
  }, /*#__PURE__*/React.createElement("p", {
    className: "body-lg",
    style: {
      maxWidth: "60ch"
    }
  }, "Una joya bien tratada conserva su acabado durante d\xE9cadas. Estos seis pasos cubren el 95% de lo que necesitas saber para mantener tu VETA como el d\xEDa uno."))), /*#__PURE__*/React.createElement("div", {
    className: "care-steps"
  }, steps.map((s, i) => /*#__PURE__*/React.createElement(Reveal, {
    key: i,
    delay: i * 60,
    className: "care-step"
  }, /*#__PURE__*/React.createElement("div", {
    className: "care-step-n"
  }, s.n), /*#__PURE__*/React.createElement("h3", null, s.title), /*#__PURE__*/React.createElement("p", null, s.body)))));
}

/* ─────────────────────────────────────────────
   Expose
   ───────────────────────────────────────────── */
Object.assign(window, {
  Home,
  Catalog,
  PDP,
  Care
});
