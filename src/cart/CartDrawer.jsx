/* VETA · cajón lateral del carrito.
   Lista los items con su estado de stock, totales con descuento y el botón
   "Continuar por WhatsApp". */

import { useEffect } from "react";
import { VETA_DATA } from "../lib/data.js";
import { db } from "../lib/db.js";
import { getStockStatus } from "../lib/stock.js";
import { Magnetic, Placeholder } from "../components/primitives.jsx";
import { CartCoupon } from "./CartCoupon.jsx";

export function CartDrawer({ open, onClose, cart, waPhone }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const toWhatsApp = () => {
    if (cart.items.length === 0) return;
    const lines = cart.items.map(
      (it) =>
        `• ${it.name} (${it.material}, ${it.finish}, talla ${it.size}) x${it.qty} — ${VETA_DATA.fmtPrice(it.price * it.qty)} COP`
    );
    const quoteCode = db.genQuoteCode();
    const msg = [
      quoteCode ? `Pedido #${quoteCode}` : null,
      "",
      "¡Hola! Vi estos productos en su catálogo y me interesan:",
      "",
      ...lines,
      cart.appliedCode ? `Código aplicado: ${cart.appliedCode.code}` : null,
      "",
      "¿Me ayudan a confirmar disponibilidad y tiempos de envío? ¡Gracias!",
    ]
      .filter((l) => l !== null)
      .join("\n");
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    // Abrir de inmediato, sin await previo: en móvil, cualquier demora entre
    // el clic y la navegación hace que el sistema no reconozca el deep link
    // a la app de WhatsApp y caiga al fallback de la tienda de apps.
    window.open(url, "_blank", "noopener");
    // El guardado de la cotización corre después, en paralelo, sin bloquear.
    if (quoteCode) {
      try {
        db.saveCartQuote({
          code: quoteCode,
          items: cart.items.map((it) => ({
            id: it.id,
            name: it.name,
            material: it.material,
            finish: it.finish,
            size: it.size,
            qty: it.qty,
            price: it.price,
          })),
          subtotal: cart.subtotal,
          discountCode: cart.appliedCode?.code || null,
          discountAmount: cart.discountAmount || 0,
          total: cart.total,
        });
      } catch {}
    }
    if (cart.appliedCode) {
      try {
        db.incrementCodeUses(cart.appliedCode.code);
      } catch {}
    }
  };

  return (
    <>
      <div className="cart-scrim" data-on={open ? "1" : "0"} onClick={onClose} />
      <aside className="cart-drawer" data-on={open ? "1" : "0"} aria-hidden={!open}>
        <header className="cart-head">
          <h3>Tu bolsa</h3>
          <button className="cart-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="cart-body">
          {cart.items.length === 0 ? (
            <div className="cart-empty">
              <div
                className="serif"
                style={{ fontSize: 28, fontWeight: 300, fontStyle: "italic", color: "var(--ink)" }}
              >
                Aún sin piezas.
              </div>
              <p className="body" style={{ maxWidth: 30, minWidth: 240 }}>
                Las elecciones aparecerán aquí antes de pasar a WhatsApp.
              </p>
              <button
                className="btn btn--ghost"
                onClick={() => {
                  onClose();
                  location.hash = "catalog";
                }}
                style={{ marginTop: 16 }}
              >
                Explorar catálogo
              </button>
            </div>
          ) : (
            cart.items.map((it) => {
              const st = getStockStatus(it.id, it.size);
              const atLimit = st.qty !== null && it.qty >= st.qty;
              return (
                <div
                  key={it.key}
                  className={`cart-item${st.status === "out" ? " cart-item--out" : ""}`}
                >
                  <Placeholder
                    shape={it.shape}
                    tag={it.id.toUpperCase()}
                    img={it.img || undefined}
                  />
                  <div>
                    <h4>{it.name}</h4>
                    <div className="vmeta">
                      {it.material} · {it.finish} · Talla {it.size}
                    </div>
                    {st.status === "low" && (
                      <span className="cart-stock-badge cart-stock-badge--low">
                        Solo quedan {st.qty}
                      </span>
                    )}
                    {st.status === "out" && (
                      <span className="cart-stock-badge cart-stock-badge--out">
                        Agotado — quitar del pedido
                      </span>
                    )}
                    <div className="cart-qty">
                      <button onClick={() => cart.setQty(it.key, it.qty - 1)} aria-label="Menos">
                        −
                      </button>
                      <span>{it.qty}</span>
                      <button
                        onClick={() => cart.setQty(it.key, it.qty + 1)}
                        disabled={atLimit || st.status === "out"}
                        aria-label="Más"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="cart-item-side">
                    <span className="price">{VETA_DATA.fmtPrice(it.price * it.qty)}</span>
                    <button className="remove" onClick={() => cart.remove(it.key)}>
                      Quitar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {cart.items.length > 0 && (
          <footer className="cart-foot">
            <CartCoupon cart={cart} />
            <div className="cart-totals">
              <div className="row">
                <span>Subtotal</span>
                <span>{VETA_DATA.fmtPrice(cart.subtotal)} COP</span>
              </div>
              {cart.discountAmount > 0 && (
                <div className="row cart-discount-row">
                  <span>Descuento ({cart.appliedCode.code})</span>
                  <span className="cart-discount-amount">
                    −{VETA_DATA.fmtPrice(cart.discountAmount)} COP
                  </span>
                </div>
              )}
              <div className="row">
                <span>Envío</span>
                <span>Se confirma por WhatsApp</span>
              </div>
              <div className="row total">
                <span>Total estimado</span>
                <span>{VETA_DATA.fmtPrice(cart.total)} COP</span>
              </div>
            </div>
            <Magnetic strength={0.1}>
              <button className="btn btn-wa" style={{ width: "100%" }} onClick={toWhatsApp}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ verticalAlign: "middle", marginRight: 2 }}
                  aria-hidden="true"
                >
                  <path d="M20.5 3.5A11 11 0 0 0 3.4 17.6L2 22l4.5-1.4a11 11 0 0 0 5.5 1.5h0a11 11 0 0 0 11-11 11 11 0 0 0-2.5-7.6Zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-2.7.9.9-2.6-.2-.3a9 9 0 1 1 6.9 3.4Zm5-6.7c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.6.1a7 7 0 0 1-3.6-3.2c-.3-.5.3-.4.7-1.3.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.2-.6-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.4a3 3 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.7.2.2 2 3 4.7 4.2 1.7.7 2.3.8 3.1.6.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.2-.2-.5-.4Z" />
                </svg>
                Continuar por WhatsApp
              </button>
            </Magnetic>
            <p className="caption" style={{ textAlign: "center", margin: 0 }}>
              Concretamos la venta y el envío contigo, persona a persona.
            </p>
          </footer>
        )}
      </aside>
    </>
  );
}
