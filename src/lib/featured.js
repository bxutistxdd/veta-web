/* VETA · destacados del Home.
   Modo "manual" (el admin marca piezas) o "auto" (4-6 al azar con semilla
   diaria, priorizando las marcadas). La semilla por día hace que la selección
   automática se mantenga estable durante la jornada y rote cada día. */

import { db } from "./db.js";

function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// PRNG determinista (mulberry32) — misma semilla, misma secuencia.
function seededRng(seed) {
  let t = seed;
  return function () {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickDailyFeatured(products) {
  const mode = db.getSetting("featured_mode", "auto") || "auto";

  if (mode === "manual") {
    const picked = products.filter((p) => p.featured === true);
    if (picked.length) return picked.slice(0, 6);
  }

  const rng = seededRng(dailySeed());
  const count = 4 + Math.floor(rng() * 3); // 4, 5 o 6
  const marked = seededShuffle(
    products.filter((p) => p.featured === true),
    rng
  );
  const rest = seededShuffle(
    products.filter((p) => p.featured !== true),
    rng
  );
  return marked.concat(rest).slice(0, count);
}
