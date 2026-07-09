/* VETA · banner superior con el código de descuento público activo.
   Se puede cerrar por código (se recuerda en localStorage) y expone su altura
   como --promo-h para que el marquee del Home ajuste su margen. */

import { useState, useEffect, useRef } from "react";
import { db } from "../lib/db.js";
import { VETA_DATA } from "../lib/data.js";

const PROMO_DISMISS_KEY = "veta_promo_dismissed";

export function SitePromoBanner({ onOpenCart }) {
  const [promo, setPromo] = useState(() => db.getPublicPromoCode());
  const [dismissedCode, setDismissedCode] = useState(() => {
    try {
      return localStorage.getItem(PROMO_DISMISS_KEY) || null;
    } catch {
      return null;
    }
  });
  const bannerRef = useRef(null);
  const dismissed = !!promo && dismissedCode === promo.code;

  useEffect(() => {
    const unsub = db.subscribe(() => setPromo(db.getPublicPromoCode()));
    return unsub;
  }, []);

  // Mide la altura real del banner y la expone como --promo-h para que
  // el marquee de Home ajuste su margin-top dinámicamente.
  useEffect(() => {
    const el = bannerRef.current;
    if (!el) {
      document.documentElement.style.setProperty("--promo-h", "0px");
      return;
    }
    const update = () =>
      document.documentElement.style.setProperty("--promo-h", el.offsetHeight + "px");
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => {
        ro.disconnect();
        document.documentElement.style.setProperty("--promo-h", "0px");
      };
    }
    return () => document.documentElement.style.setProperty("--promo-h", "0px");
  }, [promo, dismissed]);

  if (!promo || dismissed) return null;
  const label =
    promo.type === "percent"
      ? `${promo.value}% de descuento`
      : `${VETA_DATA.fmtPrice(promo.value)} de descuento`;
  const qualifier =
    promo.min_subtotal > 0
      ? `en compras mayores a ${VETA_DATA.fmtPrice(promo.min_subtotal)}`
      : "en tus compras";
  const close = () => {
    setDismissedCode(promo.code);
    try {
      localStorage.setItem(PROMO_DISMISS_KEY, promo.code);
    } catch {}
  };
  return (
    <div className="site-promo-banner" ref={bannerRef} role="banner">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
      <span className="site-promo-banner__text">
        Con el código <strong>{promo.code}</strong>, obtienes {label} {qualifier}
        {promo.description ? (
          <em className="site-promo-banner__desc"> · {promo.description}</em>
        ) : null}
      </span>
      <button className="site-promo-banner__cta" onClick={onOpenCart}>
        Agregar al carrito →
      </button>
      <button className="site-promo-banner__close" onClick={close} aria-label="Cerrar mensaje">
        ×
      </button>
    </div>
  );
}
