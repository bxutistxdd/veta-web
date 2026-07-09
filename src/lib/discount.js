/* VETA · cálculo de descuento (única fuente de la fórmula en el cliente)

   Antes esta operación estaba duplicada en useCart y en varios componentes.
   La validación autoritativa (vigencia, usos, subtotal mínimo) sigue en
   db.validateCode; esto solo calcula el monto a restar dado un código ya
   aplicado, para pintar totales al instante sin volver a consultar la BD. */

/**
 * Monto de descuento en COP para un subtotal y un código aplicado.
 * @param {number} subtotal
 * @param {{type:"percent"|"fixed", value:number}|null} code
 * @returns {number} monto a restar (0 si no hay código o subtotal <= 0)
 */
export function applyDiscount(subtotal, code) {
  if (!code || subtotal <= 0) return 0;
  if (code.type === "percent") return Math.round((subtotal * code.value) / 100);
  return Math.min(Number(code.value), subtotal);
}
