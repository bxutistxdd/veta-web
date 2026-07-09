/* VETA · helpers de stock compartidos por el sitio público
   Derivan un estado legible (ok / low / out) de la cantidad en Supabase. */

import { db } from "./db.js";

// Estado de una talla concreta: null = sin definir (no se limita), 0 = agotado,
// <=2 = quedan pocas, resto = disponible.
export function getStockStatus(pid, sz) {
  const qty = db.getStock(pid, sz);
  if (qty === null) return { qty: null, status: "ok" };
  if (qty === 0) return { qty: 0, status: "out" };
  if (qty <= 2) return { qty, status: "low" };
  return { qty, status: "ok" };
}

// Un producto está agotado solo si TODAS sus tallas tienen stock definido en 0.
export function isProductSoldOut(product) {
  if (!product?.sizes?.length) return false;
  return product.sizes.every((sz) => {
    const qty = db.getStock(product.id, sz);
    return qty !== null && qty === 0;
  });
}
