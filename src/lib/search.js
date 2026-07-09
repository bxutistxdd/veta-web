/* VETA · búsqueda de productos tolerante a errores.
   Normaliza acentos, hace match por prefijo/inclusión y, para tokens largos,
   permite una distancia de edición (Levenshtein) proporcional a su longitud. */

import { db } from "./db.js";
import { VETA_DATA } from "./data.js";

// Minúsculas + quita acentos (NFD y elimina marcas combinantes U+0300–U+036F).
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

function tokenMatches(token, fieldWords) {
  if (token.length <= 2) return fieldWords.some((w) => w.startsWith(token));
  if (fieldWords.some((w) => w.includes(token) || token.includes(w))) return true;
  if (token.length >= 4)
    return fieldWords.some(
      (w) => w.length >= 3 && levenshtein(token, w) <= Math.floor(token.length / 4)
    );
  return false;
}

export function searchProducts(query, products) {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return products;

  const score = (p) => {
    const lbl = (id) =>
      db.getCategoryLabel(id) || VETA_DATA.categories.find((c) => c.id === id)?.label || "";
    const raw = [
      p.name,
      p.material,
      p.finish,
      p.cat,
      lbl(p.cat),
      lbl(p.subcat),
      lbl(p.ref),
      p.blurb,
      p.desc,
      p.id,
    ]
      .map(norm)
      .join(" ");
    const words = raw.split(/\s+/);
    let s = 0;
    for (const t of tokens) {
      if (raw.includes(t)) s += t.length * 3;
      else if (tokenMatches(t, words)) s += t.length;
      else return -1;
    }
    return s;
  };

  return products
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}
