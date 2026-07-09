/* VETA · fila de código de descuento dentro del carrito. */

import { useState } from "react";
import { VETA_DATA } from "../lib/data.js";

export function CartCoupon({ cart }) {
  const [input, setInput] = useState("");
  const handleApply = async () => {
    const ok = await cart.applyCode(input);
    if (ok) setInput("");
  };
  return (
    <div className="cart-coupon">
      <div className="cart-coupon-label">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
        Código de descuento
      </div>
      {cart.appliedCode ? (
        <div className="cart-coupon-applied">
          <span className="cart-coupon-badge">
            {cart.appliedCode.code}
            {" · "}
            {cart.appliedCode.type === "percent"
              ? `${cart.appliedCode.value}% OFF`
              : `${VETA_DATA.fmtPrice(cart.appliedCode.value)} OFF`}
          </span>
          <button
            className="cart-coupon-remove"
            onClick={cart.removeCode}
            aria-label="Quitar código"
          >
            ✕ Quitar
          </button>
        </div>
      ) : (
        <div className="cart-coupon-row">
          <input
            className="cart-coupon-input"
            placeholder="VETAINAUGURACIÓN"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) =>
              e.key === "Enter" && !cart.codeLoading && input.trim() && handleApply()
            }
            aria-label="Código de descuento"
          />
          <button
            className="cart-coupon-btn"
            onClick={handleApply}
            disabled={!input.trim() || cart.codeLoading}
          >
            {cart.codeLoading ? "…" : "Aplicar"}
          </button>
        </div>
      )}
      {cart.codeError && <p className="cart-coupon-error">{cart.codeError}</p>}
    </div>
  );
}
