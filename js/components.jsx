/* VETA · componentes base
   Placeholder, Reveal, MagneticButton, SplitText, Nav, Footer, Marquee
   Cada componente expone su API por window al final. */

const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;

/* ─────────────────────────────────────────────
   Hook · useInView (IntersectionObserver)
   ───────────────────────────────────────────── */
function useInView(opts = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    let fallbackT = 0;

    // Sync check: si ya está en viewport al montar, revela inmediato.
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < vh * 0.92 && r.bottom > 0) {
      setInView(true);
      if (opts.once !== false) return () => {};
    }

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return () => {};
    }

    const obs = new IntersectionObserver(
      ([e]) => {
        if (!alive) return;
        if (e.isIntersecting) {
          setInView(true);
          if (opts.once !== false) obs.unobserve(el);
        } else if (opts.once === false) {
          setInView(false);
        }
      },
      { threshold: opts.threshold ?? 0.15, rootMargin: opts.rootMargin ?? "0px 0px -8% 0px" }
    );
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
function Reveal({ children, delay = 0, as = "div", className = "", style, variant = "" }) {
  const [ref, inView] = useInView();
  const Tag = as;
  const cls = ["reveal", variant && `reveal--${variant}`, className].filter(Boolean).join(" ");
  return (
    <Tag ref={ref} className={cls} data-in={inView ? "1" : "0"}
         style={{ "--reveal-delay": `${delay}ms`, ...style }}>
      {children}
    </Tag>
  );
}

/* ─────────────────────────────────────────────
   SplitText — anima cada carácter
   ───────────────────────────────────────────── */
function SplitText({ text, charDelay = 0, stagger = 28, className = "", as = "span" }) {
  const [ref, inView] = useInView();
  const Tag = as;
  const tokens = useMemo(() => {
    const words = text.split(/(\s+)/);
    let i = 0;
    return words.map((w, wi) => {
      if (/^\s+$/.test(w)) return { kind: "space", text: w, key: `s${wi}` };
      const chars = [...w].map((c) => ({ kind: "char", text: c, idx: i++ }));
      return { kind: "word", chars, key: `w${wi}` };
    });
  }, [text]);
  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {tokens.map((t) => {
        if (t.kind === "space") return <span key={t.key}>{t.text}</span>;
        return (
          <span key={t.key} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {t.chars.map((c) => (
              <span key={c.idx} className="split-char" data-in={inView ? "1" : "0"}
                    style={{ "--i": c.idx, "--char-delay": `${charDelay}ms` }}
                    aria-hidden="true">
                {c.text}
              </span>
            ))}
          </span>
        );
      })}
    </Tag>
  );
}

/* ─────────────────────────────────────────────
   MagneticButton — con gating por distancia.
   ───────────────────────────────────────────── */
function Magnetic({ children, strength = 0.3, radius = 110, className = "", style, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Solo activar en dispositivos con mouse real; en touch el CSS :active maneja la retroalimentación
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
    let raf = 0;
    let tx = 0, ty = 0, x = 0, y = 0;

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const halfW = r.width / 2;
      const halfH = r.height / 2;
      const outsideX = Math.max(0, Math.abs(dx) - halfW);
      const outsideY = Math.max(0, Math.abs(dy) - halfH);
      const edgeDist = Math.hypot(outsideX, outsideY);

      if (edgeDist > radius) {
        tx = 0; ty = 0;
      } else {
        const fall = 1 - edgeDist / radius;
        const ease = fall * fall;
        tx = dx * strength * ease;
        ty = dy * strength * ease;
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const loop = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      const settled = Math.abs(tx - x) < 0.05 && Math.abs(x) < 0.05 && Math.abs(ty - y) < 0.05 && Math.abs(y) < 0.05;
      if (settled) { raf = 0; el.style.transform = "translate3d(0,0,0)"; }
      else raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [strength, radius]);
  return (
    <span ref={ref} className={className} style={{ display: "inline-block", willChange: "transform", ...style }} {...rest}>
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────
   ProductPlaceholder — SVG monocromo con etiqueta
   ───────────────────────────────────────────── */
function PHShape({ kind }) {
  switch (kind) {
    case "ring":
      return (
        <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid meet">
          <ellipse cx="200" cy="250" rx="110" ry="105" className="ph-shape" />
          <ellipse cx="200" cy="250" rx="78" ry="74" className="ph-shape" />
          <ellipse cx="200" cy="245" rx="95" ry="20" className="ph-shape fill" />
        </svg>
      );
    case "necklace":
      return (
        <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid meet">
          <path d="M 80 120 Q 200 320 320 120" className="ph-shape" />
          <path d="M 90 130 Q 200 305 310 130" className="ph-shape" />
          <line x1="200" y1="295" x2="200" y2="365" className="ph-shape" />
          <circle cx="200" cy="385" r="22" className="ph-shape fill" />
        </svg>
      );
    case "earring":
      return (
        <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid meet">
          <line x1="150" y1="130" x2="150" y2="280" className="ph-shape" />
          <circle cx="150" cy="300" r="14" className="ph-shape fill" />
          <line x1="250" y1="130" x2="250" y2="350" className="ph-shape" />
          <circle cx="250" cy="370" r="14" className="ph-shape fill" />
        </svg>
      );
    case "bracelet":
      return (
        <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid meet">
          <ellipse cx="200" cy="250" rx="140" ry="110" className="ph-shape" />
          <ellipse cx="200" cy="250" rx="130" ry="100" className="ph-shape" />
          <ellipse cx="200" cy="200" rx="140" ry="20" className="ph-shape fill" />
        </svg>
      );
    case "piercing":
      return (
        <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid meet">
          <circle cx="200" cy="250" r="80" className="ph-shape" />
          <circle cx="200" cy="170" r="10" className="ph-shape fill" />
          <circle cx="200" cy="330" r="10" className="ph-shape fill" />
        </svg>
      );
    default:
      return null;
  }
}

function Placeholder({ shape = "ring", label, tag, ratio, className = "", style, img, ...rest }) {
  return (
    <div className={`ph ${img ? "ph--img" : ""} ${className}`} style={{ "--ph-ratio": ratio, ...style }} {...rest}>
      {img ? (
        <img src={img} alt="" loading="lazy" className="ph-img" />
      ) : (
        <PHShape kind={shape} />
      )}
      {tag && <div className="ph-tag">{tag}</div>}
      {label && <div className="ph-label">{label}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Wordmark · VETA
   ───────────────────────────────────────────── */
function Wordmark({ onClick }) {
  return (
    <a className="wordmark" href="#" onClick={(e) => { e.preventDefault(); onClick?.(); }} aria-label="VETA · inicio">
      VETA
    </a>
  );
}

/* ─────────────────────────────────────────────
   Nav
   ───────────────────────────────────────────── */
function Nav({ route, onNavigate, cartCount, cartBump, onCartOpen, theme, onThemeToggle, onSearchOpen }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Cierra el menú cuando cambia la ruta */
  useEffect(() => { setMenuOpen(false); }, [route]);

  /* Bloquea scroll del body cuando el menú está abierto */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  /* Cierra con Escape */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const links = [
    { id: "home",    label: "Inicio" },
    { id: "catalog", label: "Catálogo" },
    { id: "care",    label: "Cuidado" },
  ];
  const isActive = (id) => {
    if (id === "catalog") return route.name === "catalog" || route.name === "pdp";
    return route.name === id;
  };
  const handleNav = (r) => { setMenuOpen(false); onNavigate(r); };

  return (
    <>
      <nav className="nav" data-scrolled={scrolled ? "1" : "0"}>
        <div><Wordmark onClick={() => handleNav({ name: "home" })} /></div>
        <div className="nav-links">
          {links.map((l) => (
            <Magnetic key={l.id} strength={0.4} radius={48}>
              <a className="nav-link" data-active={isActive(l.id) ? "1" : "0"}
                 href="#" onClick={(e) => { e.preventDefault(); handleNav({ name: l.id }); }}>
                {l.label}
              </a>
            </Magnetic>
          ))}
        </div>
        <div className="nav-right">
          <button
            className="theme-toggle"
            data-theme={theme}
            onClick={onThemeToggle}
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          >
            <span className="theme-toggle-icon" aria-hidden="true">
              <svg className="sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
              </svg>
              <svg className="moon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
              </svg>
            </span>
          </button>
          <button className="nav-search-btn" onClick={onSearchOpen} aria-label="Buscar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="17" height="17" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.5-4.5" />
            </svg>
          </button>
          <button className="nav-cart-btn" data-bump={cartBump ? "1" : "0"} onClick={onCartOpen}>
            Bolsa
            <span className="nav-cart-count">{cartCount}</span>
          </button>
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
          >
            <span className="nav-hamburger-icon" data-open={menuOpen ? "1" : "0"}>
              <span /><span /><span />
            </span>
          </button>
        </div>
      </nav>

      {/* Menú móvil fullscreen — z-index 99, el nav queda encima (100) */}
      <div
        className="nav-mobile-menu"
        data-on={menuOpen ? "1" : "0"}
        aria-hidden={!menuOpen}
        role="dialog"
        aria-label="Menú de navegación"
      >
        {links.map((l) => (
          <a
            key={l.id}
            className="nav-mobile-link"
            data-active={isActive(l.id) ? "1" : "0"}
            href="#"
            tabIndex={menuOpen ? 0 : -1}
            onClick={(e) => { e.preventDefault(); handleNav({ name: l.id }); }}
          >
            {l.label}
          </a>
        ))}
        <div className="nav-mobile-footer">
          <span>VETA · 2026</span>
          <span>Hecho en Colombia</span>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   Marquee de categorías
   ───────────────────────────────────────────── */
function Marquee({ items, compact = false }) {
  const content = (
    <span>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <span>{it}</span>
          <span className="marquee-dot" />
        </React.Fragment>
      ))}
    </span>
  );
  return (
    <div className={compact ? "marquee marquee--compact" : "marquee"} aria-hidden="true">
      <div className="marquee-track">{content}{content}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Footer
   ───────────────────────────────────────────── */
function Footer({ onNavigate }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-col">
          <div className="wordmark" style={{ fontSize: 16 }}>VETA</div>
          <p className="footer-tagline">
            Plata ley 925 y oro laminado, hechos a mano para acompañar.
          </p>
        </div>
        <div className="footer-col">
          <h4>Tienda</h4>
          <a href="#" onClick={(e) => { e.preventDefault(); onNavigate({ name: "catalog", filter: "anillos" }); }}>Anillos</a>
          <a href="#" onClick={(e) => { e.preventDefault(); onNavigate({ name: "catalog", filter: "collares" }); }}>Collares</a>
          <a href="#" onClick={(e) => { e.preventDefault(); onNavigate({ name: "catalog", filter: "aretes" }); }}>Aretes</a>
          <a href="#" onClick={(e) => { e.preventDefault(); onNavigate({ name: "catalog", filter: "pulseras" }); }}>Pulseras</a>
          <a href="#" onClick={(e) => { e.preventDefault(); onNavigate({ name: "catalog", filter: "piercings" }); }}>Piercings</a>
        </div>
        <div className="footer-col">
          <h4>Marca</h4>
          <a href="#" onClick={(e) => { e.preventDefault(); onNavigate({ name: "care" }); }}>Cuidado de la joya</a>
          <a href="#">Nuestra historia</a>
          <a href="#">Garantía</a>
          <a href="#">Envíos</a>
        </div>
        <div className="footer-col">
          <h4>Contacto</h4>
          <a href="https://wa.me/573243147031" target="_blank" rel="noopener">WhatsApp</a>
          <a href="https://www.instagram.com/vetajoyeria.co/" target="_blank" rel="noopener">Instagram</a>
          <a href="mailto:veyajoyeria.coloficial@gmail.com">veyajoyeria.coloficial@gmail.com</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 VETA</span>
        <span>Hecho con tiempo, no con prisa.</span>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────
   Stock helpers (compartidos en todo el sitio)
   ───────────────────────────────────────────── */
function getStockStatus(pid, sz) {
  // Supabase primero, fallback a admin localStorage
  const qty = window.VETA_DB
    ? window.VETA_DB.getStock(pid, sz)
    : window.VETA_ADMIN?.getStock(pid, sz) ?? null;
  if (qty === null) return { qty: null, status: "ok" };
  if (qty === 0)    return { qty: 0, status: "out" };
  if (qty <= 2)     return { qty, status: "low" };
  return { qty, status: "ok" };
}

function isProductSoldOut(product) {
  if (!product?.sizes?.length) return false;
  const adm = window.VETA_ADMIN;
  if (!adm) return false;
  return product.sizes.every(sz => {
    const qty = adm.getStock(product.id, sz);
    return qty !== null && qty === 0;
  });
}

/* ─────────────────────────────────────────────
   ProductCard
   ───────────────────────────────────────────── */
function ProductCard({ product, onOpen, delay = 0 }) {
  const shape = VETA_DATA.shapes[product.cat]?.kind || "ring";
  const img = product.images?.main || (window.VETA_IMG || {})[product.id];
  const soldOut = isProductSoldOut(product);
  return (
    <Reveal delay={delay}>
      <button className={`product-card${soldOut ? " product-card--out" : ""}`} onClick={() => onOpen(product)}>
        <Placeholder
          shape={shape}
          label={`${product.material.toLowerCase()} / ${product.finish.toLowerCase()}`}
          tag={product.id.toUpperCase()}
          img={img}
        />
        {soldOut && <span className="product-card-soldout">Agotado</span>}
        <div className="product-card-meta">
          <div>
            <h4>{product.name}</h4>
            <span className="product-card-sub">{product.material}</span>
          </div>
          <span className="price">{VETA_DATA.fmtPrice(product.price)}</span>
        </div>
      </button>
    </Reveal>
  );
}

/* ─────────────────────────────────────────────
   Expose
   ───────────────────────────────────────────── */
Object.assign(window, {
  useInView, Reveal, SplitText, Magnetic,
  PHShape, Placeholder, Wordmark, Nav, Marquee,
  Footer, ProductCard,
});
