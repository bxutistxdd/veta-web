/* VETA · lectura del catálogo visible para el sitio público. */

import { db } from "./db.js";

// Productos visibles (los ocultos por el admin no se muestran en la tienda).
// db.getProducts() ya devuelve el seed estático como fallback si Supabase
// todavía no cargó, así que nunca es null.
export function visibleProducts() {
  return db.getProducts().filter((p) => p.visible !== false);
}
