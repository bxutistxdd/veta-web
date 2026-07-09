/* VETA · primitivas de UI reutilizables
   Hook de scroll-reveal + componentes de animación y placeholders visuales. */

import { useState, useEffect, useRef, useMemo } from "react";

/* ─────────────────────────────────────────────
   Hook · useInView (IntersectionObserver)
   ───────────────────────────────────────────── */
export function useInView(opts = {}) {
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
export function Reveal({ children, delay = 0, as = "div", className = "", style, variant = "" }) {
  const [ref, inView] = useInView();
  const Tag = as;
  const cls = ["reveal", variant && `reveal--${variant}`, className].filter(Boolean).join(" ");
  return (
    <Tag
      ref={ref}
      className={cls}
      data-in={inView ? "1" : "0"}
      style={{ "--reveal-delay": `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

/* ─────────────────────────────────────────────
   SplitText — anima cada carácter
   ───────────────────────────────────────────── */
export function SplitText({ text, charDelay = 0, className = "", as = "span" }) {
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
              <span
                key={c.idx}
                className="split-char"
                data-in={inView ? "1" : "0"}
                style={{ "--i": c.idx, "--char-delay": `${charDelay}ms` }}
                aria-hidden="true"
              >
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
   Magnetic — atracción al cursor con gating por distancia.
   Solo se activa con mouse real; en touch el CSS :active da el feedback.
   ───────────────────────────────────────────── */
export function Magnetic({
  children,
  strength = 0.3,
  radius = 110,
  className = "",
  style,
  ...rest
}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
    let raf = 0;
    let tx = 0,
      ty = 0,
      x = 0,
      y = 0;

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
        tx = 0;
        ty = 0;
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
      const settled =
        Math.abs(tx - x) < 0.05 &&
        Math.abs(x) < 0.05 &&
        Math.abs(ty - y) < 0.05 &&
        Math.abs(y) < 0.05;
      if (settled) {
        raf = 0;
        el.style.transform = "translate3d(0,0,0)";
      } else raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [strength, radius]);
  return (
    <span
      ref={ref}
      className={className}
      style={{ display: "inline-block", willChange: "transform", ...style }}
      {...rest}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────
   PHShape — SVG monocromo por tipo de joya (placeholder iconográfico)
   ───────────────────────────────────────────── */
export function PHShape({ kind }) {
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

/* Contenedor de imagen/placeholder con etiqueta opcional. */
export function Placeholder({
  shape = "ring",
  label,
  tag,
  ratio,
  className = "",
  style,
  img,
  ...rest
}) {
  return (
    <div
      className={`ph ${img ? "ph--img" : ""} ${className}`}
      style={{ "--ph-ratio": ratio, ...style }}
      {...rest}
    >
      {img ? <img src={img} alt="" loading="lazy" className="ph-img" /> : <PHShape kind={shape} />}
      {tag && <div className="ph-tag">{tag}</div>}
      {label && <div className="ph-label">{label}</div>}
    </div>
  );
}
