/* VETA · pantalla de inicio.
   Hero interactivo, carrusel editorial, galería de categorías, destacados del
   día, manifiesto y cifras. Todos los sub-bloques viven aquí porque solo los
   usa el Home. */

import { useState, useEffect, useRef, useMemo } from "react";
import { VETA_DATA } from "../lib/data.js";
import { db } from "../lib/db.js";
import { visibleProducts } from "../lib/catalog.js";
import { pickDailyFeatured } from "../lib/featured.js";
import { Reveal, SplitText, Magnetic, Placeholder } from "../components/primitives.jsx";
import { Marquee } from "../components/Marquee.jsx";
import { ProductCard } from "../components/ProductCard.jsx";

export function Home({ onNavigate }) {
  const products = visibleProducts();
  const featured = useMemo(() => pickDailyFeatured(products), [products]);

  return (
    <main className="page-enter">
      <Marquee
        compact
        items={[
          "Plata ley 925",
          "Oro laminado 18k",
          "Hecho a mano en Colombia",
          "Garantía de por vida",
          "Envíos a todo el país",
          "Atención por WhatsApp",
        ]}
      />
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
    let tx = 0,
      ty = 0;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const loop = () => {
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
          <span className="eyebrow reveal" data-in="1">
            — Colección permanente · 2026
          </span>
          <div className="hero-meta reveal" data-in="1">
            <div>
              <b>Plata ley 925</b>
            </div>
            <div>Oro laminado 18k</div>
            <div>Hecho en Colombia</div>
          </div>
        </div>
        <h1 className="h-display">
          <SplitText text="Joyería" />
          <br />
          <em>
            <SplitText text="que perdura" charDelay={350} />
          </em>
        </h1>
        <div className="hero-bottom">
          <Reveal delay={900}>
            <p className="hero-tagline">
              Piezas pensadas para acompañar una vida entera. Plata ley 925 y oro laminado, fundidos
              y pulidos a mano en talleres pequeños.
            </p>
          </Reveal>
          <Reveal delay={1100}>
            <div className="hero-actions">
              <Magnetic strength={0.22} radius={140}>
                <button className="btn" onClick={() => (location.hash = "catalog")}>
                  Ver catálogo
                </button>
              </Magnetic>
              <Magnetic strength={0.22} radius={140}>
                <button
                  className="btn btn--ghost"
                  onClick={() =>
                    document
                      .getElementById("home-pin")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  Conoce VETA
                </button>
              </Magnetic>
            </div>
          </Reveal>
          <Reveal delay={1300}>
            <div className="hero-search">
              <div className="hero-search-bar">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="16"
                  height="16"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.5-4.5" />
                </svg>
                <input
                  className="hero-search-input"
                  value={heroQ}
                  onChange={(e) => setHeroQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  placeholder="Busca anillo plata, collar fino, piercing…"
                  aria-label="Buscar productos"
                />
                <button className="hero-search-go" onClick={doSearch} aria-label="Buscar">
                  →
                </button>
              </div>
              <div className="hero-search-hints">
                {["Anillo plata", "Collar 40cm", "Arete argolla"].map((h) => (
                  <button
                    key={h}
                    className="hero-search-hint"
                    onClick={() => {
                      location.hash = `catalog?q=${encodeURIComponent(h)}`;
                    }}
                  >
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

/* Carrusel horizontal editorial (material · proceso · acompañamiento). */
function HomeCarousel() {
  const slides = [
    {
      eyebrow: "01 · Material",
      title: "Plata ley 925.\nNada más, nada menos.",
      body: "92.5% de plata pura. Sin aleaciones que oxiden la piel ni sustituciones invisibles. Cada pieza viene con su sello grabado al interior.",
      shape: "ring",
      tag: "VETA · 925",
      label: "pieza fundida a mano",
    },
    {
      eyebrow: "02 · Proceso",
      title: "Talleres pequeños.\nManos que conoces.",
      body: "Trabajamos con un círculo cerrado de artesanos en Mompox y Bogotá. Series cortas, control de calidad pieza por pieza, sin intermediarios.",
      shape: "necklace",
      tag: "VETA · taller",
      label: "filigrana momposina",
    },
    {
      eyebrow: "03 · Acompañamiento",
      title: "Una compra,\nuna comunidad.",
      body: "Cuidamos a quien nos elige: garantía de por vida sobre estructura, limpieza anual gratuita y acceso a piezas exclusivas para clientela frecuente.",
      shape: "bracelet",
      tag: "VETA · comunidad",
      label: "clientela fiel",
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
              <div
                key={i}
                className="carousel-text"
                data-on={i === idx ? "1" : "0"}
                aria-hidden={i !== idx}
              >
                <span className="eyebrow">{s.eyebrow}</span>
                <h2 className="h-1" style={{ whiteSpace: "pre-line" }}>
                  {s.title}
                </h2>
                <p className="body-lg" style={{ maxWidth: "42ch" }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>

          <div className="carousel-controls">
            <button className="carousel-arrow prev" onClick={prev} aria-label="Anterior">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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

/* Un "slot" por categoría con mini-carrusel automático de sus productos. */
function CatSlot({ cat, index, onNavigate }) {
  const products = visibleProducts()
    .filter((p) => p.cat === cat.id)
    .slice(0, 4);
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
            <Placeholder
              shape={shape}
              label={p.name}
              tag={`0${i + 1}`}
              img={VETA_DATA.productImages(p)[0] || undefined}
            />
          </button>
        ))}
        {products.length > 1 && (
          <div className="cat-slot-dots" aria-hidden="true">
            {products.map((_, i) => (
              <button
                key={i}
                className="cat-slot-dot"
                data-on={i === idx ? "1" : "0"}
                onClick={(e) => {
                  e.stopPropagation();
                  setIdx(i);
                }}
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
          <h2 className="h-1">
            Cinco familias.
            <br />
            <em>Una sola lengua.</em>
          </h2>
        </div>
        <Reveal>
          <button className="btn btn--text" onClick={() => onNavigate({ name: "catalog" })}>
            Ver todo
          </button>
        </Reveal>
      </div>
      <div className="section-body">
        <div className="cat-gallery">
          {(db.getCategories(1) || VETA_DATA.categories).map((cat, i) => (
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
          <h2 className="h-1">
            Piezas que <em>elegimos hoy.</em>
          </h2>
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
            La joya
            <br />
            como <em>memoria.</em>
          </h2>
        </Reveal>
      </div>
      <div>
        <Reveal delay={200}>
          <p className="body-lg" style={{ marginBottom: 24 }}>
            Llamamos veta a la línea de plata que recorre la roca. Es lo que queda visible cuando
            todo lo demás se ha desgastado. Así pensamos las piezas: discretas, claras, hechas para
            que duren más que nosotros.
          </p>
        </Reveal>
        <Reveal delay={400}>
          <p className="body" style={{ marginBottom: 32 }}>
            No fabricamos para una temporada. Cada referencia se queda hasta que deja de tener
            sentido. Probamos cierres, pulimos cantos, hablamos con quien nos compra. Vendemos
            pocas, atendemos a todas.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function HomeNumbers() {
  const cells = [
    { num: "925", label: "Pureza de plata" },
    { num: "18k", label: "Oro laminado" },
    { num: <>∞</>, label: "Garantía estructura" },
    { num: "00", label: "Intermediarios" },
  ];
  return (
    <div className="section-body" style={{ paddingBottom: 120 }}>
      <div className="numbers">
        {cells.map((c, i) => (
          <Reveal key={i} delay={i * 100} className="num-cell">
            <div className="num">
              <em>{c.num}</em>
            </div>
            <div className="label">{c.label}</div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
