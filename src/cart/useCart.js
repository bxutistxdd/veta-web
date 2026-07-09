/* VETA · estado del carrito (persistido en localStorage).
   Guarda items y código de descuento aplicado, respeta el stock por talla al
   agregar/aumentar cantidades, y calcula subtotal/descuento/total. */

import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "../lib/db.js";
import { VETA_DATA } from "../lib/data.js";
import { applyDiscount } from "../lib/discount.js";

export function useCart() {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("veta-cart") || "[]");
    } catch {
      return [];
    }
  });
  const [appliedCode, setAppliedCode] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("veta-discount") || "null");
    } catch {
      return null;
    }
  });
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("veta-cart", JSON.stringify(items));
  }, [items]);
  useEffect(() => {
    localStorage.setItem("veta-discount", JSON.stringify(appliedCode));
  }, [appliedCode]);

  const add = useCallback((product, opts) => {
    setItems((prev) => {
      const key = `${product.id}::${opts.size}::${opts.finish}`;
      const idx = prev.findIndex((it) => it.key === key);
      const cur = idx >= 0 ? prev[idx].qty : 0;
      const req = opts.qty || 1;
      const stock = db.getStock(product.id, opts.size);
      const cap = stock !== null && stock !== undefined ? stock : Infinity;
      const newQty = Math.min(cur + req, cap);
      if (newQty <= 0) return prev;
      if (idx >= 0) {
        if (newQty === prev[idx].qty) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], qty: newQty };
        return next;
      }
      return [
        ...prev,
        {
          key,
          id: product.id,
          name: product.name,
          price: product.price,
          material: product.material,
          size: opts.size,
          finish: opts.finish,
          qty: newQty,
          img: VETA_DATA.productImages(product)[0] || null,
          shape: VETA_DATA.shapes[product.cat]?.kind || "ring",
        },
      ];
    });
  }, []);
  const remove = useCallback((key) => setItems((prev) => prev.filter((it) => it.key !== key)), []);
  const setQty = useCallback(
    (key, qty) =>
      setItems((prev) => {
        if (qty <= 0) return prev.filter((it) => it.key !== key);
        const item = prev.find((it) => it.key === key);
        if (!item) return prev;
        const stock = db.getStock(item.id, item.size);
        const cap = stock !== null && stock !== undefined ? stock : Infinity;
        return prev.map((it) => (it.key === key ? { ...it, qty: Math.min(qty, cap) } : it));
      }),
    []
  );
  const clear = useCallback(() => {
    setItems([]);
    setAppliedCode(null);
    setCodeError("");
  }, []);

  const count = items.reduce((a, it) => a + it.qty, 0);
  const subtotal = items.reduce((a, it) => a + it.qty * it.price, 0);

  const discountAmount = useMemo(
    () => applyDiscount(subtotal, appliedCode),
    [appliedCode, subtotal]
  );

  const total = subtotal - discountAmount;

  const applyCode = async (code) => {
    const trimmed = (code || "").trim();
    if (!trimmed) return false;
    setCodeLoading(true);
    setCodeError("");
    try {
      const result = await db.validateCode(trimmed, subtotal);
      if (result.valid) {
        setAppliedCode({
          code: result.code,
          type: result.type,
          value: result.value,
          description: result.description,
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

  const removeCode = useCallback(() => {
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
    codeLoading,
  };
}
