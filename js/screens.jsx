/* VETA · pantallas
   Home, Catalog, PDP, Care
   Cada pantalla recibe { onNavigate, onAdd, ... } por props.
*/

/* Devuelve solo los productos visibles — Supabase primero, localStorage como fallback */
function visibleProducts() {
  if (window.VETA_DB) {
    const all = window.VETA_DB.getProducts();
    return all.filter(p => p.visible !== false);
  }
  const adm = window.VETA_ADMIN;
  const all = adm ? adm.getProducts() : VETA_DATA.products;
  return adm ? all.filter(p => !adm.isHidden(p.id)) : all;
}

/* ─────────────────────────────────────────────
   Destacados del Home — rotación diaria con semilla
   ───────────────────────────────────────────── */
function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededRng(seed) {
  let t = seed;
  return function () {
    t |= 0; t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Modo manual (admin elige) o automático (4-6 al azar, prioriza p.featured, se renueva cada día) */
function pickDailyFeatured(products) {
  const db = window.VETA_DB;
  const mode = (db && db.getSetting("featured_mode", "auto")) || "auto";

  if (mode === "manual") {
    const ids = (db && db.getSetting("featured_manual_ids", [])) || [];
    const picked = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
    if (picked.length) return picked.slice(0, 6);
  }

  const rng = seededRng(dailySeed());
  const count = 4 + Math.floor(rng() * 3); // 4, 5 o 6
  const marked = seededShuffle(products.filter((p) => p.featured === true), rng);
  const rest = seededShuffle(products.filter((p) => p.featured !== true), rng);
  return marked.concat(rest).slice(0, count);
}

/* ─────────────────────────────────────────────
   Búsqueda de productos
   ───────────────────────────────────────────── */
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i-1] === b[j-1] ? prev : 1 + Math.min(prev, dp[j], dp[j-1]);
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
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return products;

  const score = (p) => {
    const catLabel = (VETA_DATA.categories.find(c => c.id === p.cat)?.label) || "";
    const raw = [p.name, p.material, p.finish, p.cat, catLabel, p.blurb, p.desc, p.id]
      .map(norm).join(" ");
    const words = raw.split(/\s+/);
    let s = 0;
    for (const t of tokens) {
      if (raw.includes(t)) s += t.length * 3;
      else if (tokenMatches(t, words)) s += t.length;
      else return -1;
    }
    return s;
  };

  return products
    .map(p => ({ p, s: score(p) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.p);
}

/* ─────────────────────────────────────────────
   HOME
   ───────────────────────────────────────────── */
function Home({ onNavigate, onAdd }) {
  const products = visibleProducts();
  const featured = useMemo(() => pickDailyFeatured(products), [products]);

  return (
    <main className="page-enter">
      <Marquee compact items={[
        "Plata ley 925",
        "Oro laminado 18k",
        "Hecho a mano en Colombia",
        "Garantía de por vida",
        "Envíos a todo el país",
        "Atención por WhatsApp",
      ]} />
      <HomeHero />
      <HomeCarousel />
      <HomeCategories onNavigate={onNavigate} />
      <HomeFeatured products={featured} onOpen={(p) => onNavigate({ name: "pdp", id: p.id })} />
      <HomeManifesto />
      <HomeNumbers />
    </main>
  );
}

function HomeHero() {
  const heroRef = useRef(null);
  const [heroQ, setHeroQ] = useState("");

  const doSearch = () => {
    const q = heroQ.trim();
    if (q) location.hash = `catalog?q=${encodeURIComponent(q)}`;
  };

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    let raf = 0;
    let tx = 0, ty = 0;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width  - 0.5);
      ty = ((e.clientY - r.top)  / r.height - 0.5);
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const loop = () => {
      el.style.setProperty("--mx", tx.toFixed(3));
      el.style.setProperty("--my", ty.toFixed(3));
      raf = 0;
    };
    el.addEventListener("mousemove", onMove);
    return () => { el.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section className="hero" ref={heroRef}>
      <div className="hero-bg" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="hero-grain" />
        <div className="hero-rule" />
        <svg className="hero-mark" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="0.4" />
          <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="0.4" />
          <circle cx="100" cy="100" r="48" fill="none" stroke="currentColor" strokeWidth="0.4" />
          <line x1="4" y1="100" x2="196" y2="100" stroke="currentColor" strokeWidth="0.3" />
          <line x1="100" y1="4" x2="100" y2="196" stroke="currentColor" strokeWidth="0.3" />
        </svg>
      </div>
      <div className="hero-grid">
        <div className="hero-top">
          <span className="eyebrow reveal" data-in="1">— Colección permanente · 2026</span>
          <div className="hero-meta reveal" data-in="1">
            <div><b>Plata ley 925</b></div>
            <div>Oro laminado 18k</div>
            <div>Hecho en Colombia</div>
          </div>
        </div>
        <h1 className="h-display">
          <SplitText text="Joyería" stagger={32} />
          <br />
          <em><SplitText text="que perdura" charDelay={350} stagger={32} /></em>
        </h1>
        <div className="hero-bottom">
          <Reveal delay={900}>
            <p className="hero-tagline">
              Piezas pensadas para acompañar una vida entera. Plata ley 925 y oro laminado,
              fundidos y pulidos a mano en talleres pequeños.
            </p>
          </Reveal>
          <Reveal delay={1100}>
            <div className="hero-actions">
              <Magnetic strength={0.22} radius={140}>
                <button className="btn" onClick={() => location.hash = "catalog"}>
                  Ver catálogo
                </button>
              </Magnetic>
              <Magnetic strength={0.22} radius={140}>
                <button className="btn btn--ghost" onClick={() => document.getElementById("home-pin")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  Conoce VETA
                </button>
              </Magnetic>
            </div>
          </Reveal>
          <Reveal delay={1300}>
            <div className="hero-search">
              <div className="hero-search-bar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" />
                </svg>
                <input
                  className="hero-search-input"
                  value={heroQ}
                  onChange={e => setHeroQ(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && doSearch()}
                  placeholder="Busca anillo plata, collar fino, piercing…"
                  aria-label="Buscar productos"
                />
                <button className="hero-search-go" onClick={doSearch} aria-label="Buscar">→</button>
              </div>
              <div className="hero-search-hints">
                {["Anillo plata", "Collar 40cm", "Arete argolla"].map(h => (
                  <button key={h} className="hero-search-hint"
                    onClick={() => { location.hash = `catalog?q=${encodeURIComponent(h)}`; }}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* Carrusel horizontal */
function HomeCarousel() {
  const slides = [
    {
      eyebrow: "01 · Material",
      title:   "Plata ley 925.\nNada más, nada menos.",
      body:    "92.5% de plata pura. Sin aleaciones que oxiden la piel ni sustituciones invisibles. Cada pieza viene con su sello grabado al interior.",
      shape:   "ring",
      tag:     "VETA · 925",
      label:   "pieza fundida a mano",
    },
    {
      eyebrow: "02 · Proceso",
      title:   "Talleres pequeños.\nManos que conoces.",
      body:    "Trabajamos con un círculo cerrado de artesanos en Mompox y Bogotá. Series cortas, control de calidad pieza por pieza, sin intermediarios.",
      shape:   "necklace",
      tag:     "VETA · taller",
      label:   "filigrana momposina",
    },
    {
      eyebrow: "03 · Acompañamiento",
      title:   "Una compra,\nuna comunidad.",
      body:    "Cuidamos a quien nos elige: garantía de por vida sobre estructura, limpieza anual gratuita y acceso a piezas exclusivas para clientela frecuente.",
      shape:   "bracelet",
      tag:     "VETA · comunidad",
      label:   "clientela fiel",
    },
  ];

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % total), 6000);
    return () => clearTimeout(t);
  }, [idx, paused, total]);

  const next = () => setIdx((i) => (i + 1) % total);
  const prev = () => setIdx((i) => (i - 1 + total) % total);

  return (
    <section
      id="home-pin"
      className="carousel"
      data-paused={paused ? "1" : "0"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carrusel"
    >
      <div className="carousel-inner">
        <div className="carousel-visual">
          {slides.map((s, i) => (
            <Placeholder
              key={i}
              shape={s.shape}
              tag={s.tag}
              label={s.label}
              data-on={i === idx ? "1" : "0"}
              style={{ "--ph-ratio": "4 / 5" }}
            />
          ))}
          <span className="carousel-num" aria-live="polite">
            {String(idx + 1).padStart(2, "0")} — {String(total).padStart(2, "0")}
          </span>
        </div>

        <div className="carousel-copy">
          <div className="carousel-text-stack">
            {slides.map((s, i) => (
              <div key={i} className="carousel-text" data-on={i === idx ? "1" : "0"} aria-hidden={i !== idx}>
                <span className="eyebrow">{s.eyebrow}</span>
                <h2 className="h-1" style={{ whiteSpace: "pre-line" }}>{s.title}</h2>
                <p className="body-lg" style={{ maxWidth: "42ch" }}>{s.body}</p>
              </div>
            ))}
          </div>

          <div className="carousel-controls">
            <button className="carousel-arrow prev" onClick={prev} aria-label="Anterior">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 6l-6 6 6 6" />
                <line x1="8" y1="12" x2="20" y2="12" />
              </svg>
            </button>
            <div className="carousel-dots" role="tablist">
              {slides.map((_, i) => (
                <button
                  key={i}
                  className="carousel-dot"
                  data-on={i === idx ? "1" : "0"}
                  onClick={() => setIdx(i)}
                  role="tab"
                  aria-selected={i === idx}
                  aria-label={`Ir al slide ${i + 1}`}
                />
              ))}
            </div>
            <button className="carousel-arrow next" onClick={next} aria-label="Siguiente">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="16" y2="12" />
                <path d="M10 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CatSlot({ cat, index, onNavigate }) {
  const products = visibleProducts().filter((p) => p.cat === cat.id).slice(0, 4);
  const shape = VETA_DATA.shapes[cat.id]?.kind || "ring";
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (products.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % products.length), 3500);
    return () => clearInterval(t);
  }, [products.length]);

  return (
    <Reveal delay={index * 80} className="cat-slot">
      <div className="cat-slot-carousel">
        {products.map((p, i) => (
          <button
            key={p.id}
            className="cat-slot-slide"
            data-on={i === idx ? "1" : "0"}
            onClick={() => onNavigate({ name: "pdp", id: p.id })}
            tabIndex={i === idx ? 0 : -1}
            aria-hidden={i !== idx}
          >
            <Placeholder shape={shape} label={p.name} tag={`0${i + 1}`} />
          </button>
        ))}
        {products.length > 1 && (
          <div className="cat-slot-dots" aria-hidden="true">
            {products.map((_, i) => (
              <button
                key={i}
                className="cat-slot-dot"
                data-on={i === idx ? "1" : "0"}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="cat-slot-footer">
        <span className="cat-slot-name">{cat.label}</span>
        <button
          className="btn btn--text cat-slot-link"
          onClick={() => onNavigate({ name: "catalog", filter: cat.id })}
        >
          Ver todos →
        </button>
      </div>
    </Reveal>
  );
}

function HomeCategories({ onNavigate }) {
  return (
    <>
      <div className="section-head">
        <div>
          <span className="eyebrow">— Categorías</span>
          <h2 className="h-1">Cinco familias.<br /><em>Una sola lengua.</em></h2>
        </div>
        <Reveal>
          <button className="btn btn--text" onClick={() => onNavigate({ name: "catalog" })}>
            Ver todo
          </button>
        </Reveal>
      </div>
      <div className="section-body">
        <div className="cat-gallery">
          {VETA_DATA.categories.map((cat, i) => (
            <CatSlot key={cat.id} cat={cat} index={i} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </>
  );
}

function HomeFeatured({ products, onOpen }) {
  return (
    <>
      <div className="section-head section-head--center">
        <div>
          <span className="eyebrow">— Destacados</span>
          <h2 className="h-1">Piezas que <em>elegimos hoy.</em></h2>
        </div>
      </div>
      <div className="section-body">
        <div className="featured-grid">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} onOpen={onOpen} delay={i * 80} />
          ))}
        </div>
      </div>
    </>
  );
}

function HomeManifesto() {
  return (
    <section className="manifesto">
      <div>
        <Reveal>
          <span className="eyebrow">— Manifiesto</span>
          <h2 className="h-1" style={{ marginTop: 12 }}>
            La joya<br />como <em>memoria.</em>
          </h2>
        </Reveal>
      </div>
      <div>
        <Reveal delay={200}>
          <p className="body-lg" style={{ marginBottom: 24 }}>
            Llamamos veta a la línea de plata que recorre la roca. Es lo que
            queda visible cuando todo lo demás se ha desgastado. Así pensamos
            las piezas: discretas, claras, hechas para que duren más que
            nosotros.
          </p>
        </Reveal>
        <Reveal delay={400}>
          <p className="body" style={{ marginBottom: 32 }}>
            No fabricamos para una temporada. Cada referencia se queda hasta
            que deja de tener sentido. Probamos cierres, pulimos cantos, hablamos
            con quien nos compra. Vendemos pocas, atendemos a todas.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function HomeNumbers() {
  const cells = [
    { num: "925",    label: "Pureza de plata" },
    { num: "18k",    label: "Oro laminado" },
    { num: <>∞</>,   label: "Garantía estructura" },
    { num: "00",     label: "Intermediarios" },
  ];
  return (
    <div className="section-body" style={{ paddingBottom: 120 }}>
      <div className="numbers">
        {cells.map((c, i) => (
          <Reveal key={i} delay={i * 100} className="num-cell">
            <div className="num"><em>{c.num}</em></div>
            <div className="label">{c.label}</div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CATÁLOGO
   ───────────────────────────────────────────── */
function Catalog({ filter, search, onNavigate }) {
  const all = useMemo(() => visibleProducts(), []);
  const [cat, setCat] = useState(filter || "all");
  const [mat, setMat] = useState("all");
  const [sort, setSort] = useState("default");
  const [q, setQ] = useState(search || "");

  useEffect(() => { setCat(filter || "all"); }, [filter]);
  useEffect(() => { setQ(search || ""); }, [search]);

  const filtered = useMemo(() => {
    let list = all;
    if (cat !== "all") list = list.filter((p) => p.cat === cat);
    if (mat !== "all") list = list.filter((p) => p.material === mat);
    if (q.trim()) return searchProducts(q, list);
    if (sort === "price-asc")  list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "name")       list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [all, cat, mat, q, sort]);

  return (
    <main className="page-enter">
      <header className="cat-head">
        <div>
          <span className="eyebrow">— Catálogo</span>
          <h1 className="h-1">{cat === "all" ? <>Todas las piezas</> : VETA_DATA.categories.find((c) => c.id === cat)?.label}</h1>
        </div>
        <span className="count">{String(filtered.length).padStart(2, "0")} piezas</span>
      </header>

      <div className="filters">
        <div className="filters-inner">
          <div className="catalog-search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" />
            </svg>
            <input
              className="catalog-search-input"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar en el catálogo…"
              aria-label="Buscar productos"
            />
            {q && <button className="catalog-search-clear" onClick={() => setQ("")} aria-label="Limpiar">×</button>}
          </div>
          <div className="filter-group">
            <span className="filter-group-label">Familia</span>
            <button className="chip" data-on={cat === "all" ? "1" : "0"} onClick={() => setCat("all")}>Todas</button>
            {VETA_DATA.categories.map((c) => (
              <button key={c.id} className="chip" data-on={cat === c.id ? "1" : "0"} onClick={() => setCat(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="filter-group">
            <span className="filter-group-label">Material</span>
            <button className="chip" data-on={mat === "all" ? "1" : "0"} onClick={() => setMat("all")}>Todos</button>
            {VETA_DATA.materials.map((m) => (
              <button key={m} className="chip" data-on={mat === m ? "1" : "0"} onClick={() => setMat(m)}>
                {m}
              </button>
            ))}
          </div>
          <div className="filter-group" style={{ marginLeft: "auto" }}>
            <span className="filter-group-label">Orden</span>
            <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="default">Sugerido</option>
              <option value="price-asc">Precio · menor</option>
              <option value="price-desc">Precio · mayor</option>
              <option value="name">Nombre</option>
            </select>
          </div>
        </div>
      </div>

      <div className="cat-grid-products">
        {filtered.length === 0 ? (
          <div style={{ gridColumn: "1/-1", padding: "80px 0", textAlign: "center", color: "var(--ink-soft)" }}>
            <p className="body">
            {q.trim() ? `Sin resultados para "${q}". Prueba otro término o busca algo más general.` : "Sin resultados para esta combinación."}
          </p>
          </div>
        ) : (
          filtered.map((p, i) => (
            <ProductCard key={p.id} product={p} onOpen={(p) => onNavigate({ name: "pdp", id: p.id })} delay={(i % 8) * 50} />
          ))
        )}
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────
   PDP
   ───────────────────────────────────────────── */
function PDP({ id, onNavigate, onAdd }) {
  const allProducts = window.VETA_ADMIN ? window.VETA_ADMIN.getProducts() : VETA_DATA.products;
  const product = allProducts.find((p) => p.id === id) || allProducts[0];
  const shape = VETA_DATA.shapes[product.cat]?.kind || "ring";

  const views = useMemo(() => ([
    { tag: "01 · frontal",   label: "vista frontal",      imgKey: "main"    },
    { tag: "02 · perfil",    label: "vista de perfil",    imgKey: "profile" },
    { tag: "03 · detalle",   label: "detalle de acabado", imgKey: "detail"  },
    { tag: "04 · contexto",  label: "en uso",             imgKey: "context" },
  ]), []);

  const [view, setView] = useState(0);
  const [size, setSize] = useState(() => {
    const adm = window.VETA_ADMIN;
    if (!adm) return product.sizes[0];
    return product.sizes.find(sz => adm.getStock(product.id, sz) !== 0) || product.sizes[0];
  });
  const [finish, setFinish] = useState(product.finish);
  const [qty, setQty] = useState(1);

  /* Stock de la talla seleccionada */
  const stockInfo = getStockStatus(product.id, size);
  const maxQty    = stockInfo.qty !== null ? stockInfo.qty : 99;
  const isOut     = stockInfo.status === "out";
  const isLow     = stockInfo.status === "low";

  /* Al cambiar talla: ajusta qty si supera el stock disponible */
  const handleSizeSelect = (s) => {
    const st = getStockStatus(product.id, s);
    setSize(s);
    if (st.qty !== null && qty > st.qty) setQty(Math.max(1, st.qty));
  };

  const [animKey, setAnimKey] = useState(0);
  useEffect(() => { setAnimKey((k) => k + 1); }, [view]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [id]);

  const related = visibleProducts().filter((p) => p.cat === product.cat && p.id !== product.id).slice(0, 4);

  return (
    <main className="page-enter">
      <section className="pdp">
        <div className="pdp-gallery">
          <div className="pdp-thumbs">
            {views.map((v, i) => (
              <button key={i} className="pdp-thumb" data-on={view === i ? "1" : "0"} onClick={() => setView(i)} aria-label={`Vista ${i+1}`}>
                <Placeholder shape={shape} tag={v.tag.split(" ")[0]} img={product.images?.[v.imgKey] || undefined} />
              </button>
            ))}
          </div>
          <div className="pdp-main-img" key={animKey}>
            <Placeholder shape={shape} label={views[view].label} tag={`${product.id.toUpperCase()} · ${views[view].tag}`} ratio="4 / 5" img={product.images?.[views[view].imgKey] || undefined} />
          </div>
        </div>

        <div className="pdp-info">
          <Reveal>
            <div className="pdp-cat">{VETA_DATA.categories.find((c) => c.id === product.cat)?.label} · {product.material}</div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="pdp-title">{product.name}</h1>
          </Reveal>
          <Reveal delay={200}>
            <div className="pdp-price">{VETA_DATA.fmtPrice(product.price)} <span style={{ fontSize: 12, color: "var(--ink-soft)", fontFamily: "var(--mono)", marginLeft: 8 }}>COP</span></div>
          </Reveal>
          <Reveal delay={280}>
            <p className="pdp-desc">{product.desc}</p>
          </Reveal>

          <Reveal delay={360}>
            <div className="pdp-section">
              <span className="pdp-section-label">Acabado</span>
              <div className="variant-row">
                {VETA_DATA.finishes.map((f) => (
                  <button key={f} className="variant-chip" data-on={finish === f ? "1" : "0"} onClick={() => setFinish(f)}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={440}>
            <div className="pdp-section">
              <span className="pdp-section-label">Talla / largo</span>
              <div className="size-row">
                {product.sizes.map((s) => {
                  const st = getStockStatus(product.id, s);
                  return (
                    <button
                      key={s}
                      className={`size-chip${st.status === "out" ? " size-chip--out" : st.status === "low" ? " size-chip--low" : ""}`}
                      data-on={size === s ? "1" : "0"}
                      disabled={st.status === "out"}
                      onClick={() => handleSizeSelect(s)}
                    >
                      {s}
                      {st.status === "low" && <span className="size-chip-badge">{st.qty}</span>}
                    </button>
                  );
                })}
              </div>
              {(isOut || isLow) && (
                <p className={`pdp-stock-msg pdp-stock-msg--${isOut ? "out" : "low"}`}>
                  {isOut
                    ? "Esta talla está agotada. Selecciona otra o escríbenos."
                    : `Solo ${stockInfo.qty === 1 ? "queda 1 unidad" : `quedan ${stockInfo.qty} unidades`} en esta talla.`}
                </p>
              )}
            </div>
          </Reveal>

          <Reveal delay={520}>
            <div className="pdp-section">
              <span className="pdp-section-label">Cantidad</span>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div className="cart-qty" style={{ marginTop: 0, width: "fit-content" }}>
                  <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={isOut} aria-label="Menos">−</button>
                  <span>{qty}</span>
                  <button onClick={() => setQty(Math.min(maxQty, qty + 1))} disabled={isOut || qty >= maxQty} aria-label="Más">+</button>
                </div>
                {stockInfo.qty !== null && !isOut && (
                  <span className="pdp-stock-avail">{stockInfo.qty} disponibles en esta talla</span>
                )}
              </div>
            </div>
          </Reveal>

          <Reveal delay={600}>
            <div className="pdp-add">
              <Magnetic strength={0.12} style={{ flex: 1 }}>
                <button
                  className="btn"
                  style={{ width: "100%" }}
                  disabled={isOut}
                  onClick={() => !isOut && onAdd(product, { size, finish, qty })}
                >
                  {isOut ? "Talla agotada" : "Agregar a la bolsa"}
                </button>
              </Magnetic>
            </div>
          </Reveal>

          <Reveal delay={700}>
            <div className="pdp-details">
              <details className="detail-row" open>
                <summary>Especificación</summary>
                <p>Material: <b>{product.material}</b>. Acabado: <b>{finish}</b>. Sello "925" grabado al interior. Cada pieza incluye estuche de tela y certificado.</p>
              </details>
              <details className="detail-row">
                <summary>Envío</summary>
                <p>Envío gratuito en pedidos a partir de $300.000 COP. Entrega en 3–5 días hábiles a todo Colombia. Empaque sostenible reutilizable.</p>
              </details>
              <details className="detail-row">
                <summary>Garantía</summary>
                <p>Garantía de por vida sobre la estructura. Limpieza profesional gratuita una vez al año en cualquier momento.</p>
              </details>
              <details className="detail-row">
                <summary>Cuidado</summary>
                <p>Guarda separado, evita perfumes y cremas en contacto directo. Pulir con paño suave. <a href="#" onClick={(e) => { e.preventDefault(); onNavigate({ name: "care" }); }} style={{ color: "var(--ink)", textDecoration: "underline", textDecorationThickness: "0.5px", textUnderlineOffset: 3 }}>Ver guía completa →</a></p>
              </details>
            </div>
          </Reveal>
        </div>
      </section>

      {related.length > 0 && (
        <>
          <div className="section-head">
            <div>
              <span className="eyebrow">— También te puede interesar</span>
              <h2 className="h-2">De la misma <em>familia.</em></h2>
            </div>
          </div>
          <div className="section-body" style={{ paddingBottom: 120 }}>
            <div className="feature-row">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} onOpen={(p) => onNavigate({ name: "pdp", id: p.id })} delay={i * 80} />
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

/* ─────────────────────────────────────────────
   CUIDADO
   ───────────────────────────────────────────── */
function Care() {
  const steps = [
    {
      n: "01",
      title: "Guarda separada",
      body:  "Cada pieza en su bolsa de tela o estuche. El roce entre joyas es la primera causa de microrayas en la plata.",
    },
    {
      n: "02",
      title: "Última en ponerse, primera en quitarse",
      body:  "Aplica perfume, crema y maquillaje antes de vestir la pieza. Quítala antes de dormir, nadar o entrenar.",
    },
    {
      n: "03",
      title: "Limpieza semanal suave",
      body:  "Paño de microfibra seco y movimientos circulares. Para sulfuros visibles: agua tibia, jabón neutro y secado inmediato.",
    },
    {
      n: "04",
      title: "Oro laminado: trato extra",
      body:  "Evita contacto directo con químicos. No uses pasta de dientes ni productos abrasivos: el laminado es delgado y se desgasta.",
    },
    {
      n: "05",
      title: "Limpieza profesional anual",
      body:  "Tu pieza VETA tiene una limpieza profunda gratuita al año. Escríbenos por WhatsApp para coordinar.",
    },
    {
      n: "06",
      title: "Si pierde brillo",
      body:  "Es normal: la plata se oxida con el aire. Una pulida con paño especializado (incluido en tu pedido) la devuelve a fábrica.",
    },
  ];
  return (
    <main className="page-enter">
      <section className="care-hero">
        <Reveal>
          <span className="eyebrow">— Guía</span>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="h-1">Cuidar la pieza<br /><em>es prolongar la historia.</em></h1>
        </Reveal>
        <Reveal delay={300}>
          <p className="body-lg" style={{ maxWidth: "60ch" }}>
            Una joya bien tratada conserva su acabado durante décadas. Estos seis pasos
            cubren el 95% de lo que necesitas saber para mantener tu VETA como el día uno.
          </p>
        </Reveal>
      </section>
      <div className="care-steps">
        {steps.map((s, i) => (
          <Reveal key={i} delay={i * 60} className="care-step">
            <div className="care-step-n">{s.n}</div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </Reveal>
        ))}
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────
   Expose
   ───────────────────────────────────────────── */
Object.assign(window, { Home, Catalog, PDP, Care });
