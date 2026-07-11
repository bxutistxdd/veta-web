/* VETA admin · hooks de datos.
   Envuelven la capa db (Supabase) para el panel: sesión, catálogo, stock,
   configuración y contadores (badges) de chats/despachos. Todos re-renderizan
   en vivo suscribiéndose a los cambios de db. */

import { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "../lib/db.js";
import { VETA_DATA } from "../lib/data.js";
import { adminToast } from "./toast.jsx";

export const DEFAULT_WA_PHONE = "573243147031";

// Seed de respaldo si Supabase aún no cargó.
export function seedProducts() {
  return VETA_DATA.products.map((p) => ({ ...p, images: p.images || {} }));
}

// ── Auth (Supabase) ───────────────────────────────────────
export function useAuth() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    db.getSession().then((s) => {
      setAuthed(!!s);
      setReady(true);
    });
    return db.onAuthChange((s) => setAuthed(!!s));
  }, []);

  const login = useCallback(async (pw) => {
    setLoading(true);
    setErr("");
    try {
      const { ok, error } = await db.signIn(pw);
      if (!ok)
        setErr(
          /invalid|credential/i.test(error || "")
            ? "Contraseña incorrecta."
            : error || "No se pudo iniciar sesión."
        );
    } catch {
      setErr("Error de conexión. Intenta de nuevo.");
    }
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await db.signOut();
    } catch {}
  }, []);

  return { authed, ready, loading, err, login, logout };
}

// ── Productos (Supabase como fuente de verdad) ────────────
export function useProducts() {
  const [products, setProducts] = useState(() => db.getProducts() || seedProducts());
  useEffect(() => db.subscribe(() => setProducts((db.getProducts() || []).slice())), []);

  const add = useCallback(async (p) => {
    try {
      await db.upsertProduct(p);
      adminToast(`"${p.name}" creado.`);
    } catch (e) {
      adminToast("No se pudo crear el producto: " + e.message, true);
    }
  }, []);

  const update = useCallback(async (id, data) => {
    // Conservar visible/featured (el formulario no los toca)
    const current = (db.getProducts() || []).find((p) => p.id === id) || {};
    try {
      await db.upsertProduct({ ...current, ...data, id });
      adminToast("Cambios guardados.");
    } catch (e) {
      adminToast("No se pudo guardar: " + e.message, true);
    }
  }, []);

  const remove = useCallback(async (id) => {
    try {
      await db.deleteProduct(id);
      adminToast("Producto eliminado.");
    } catch (e) {
      adminToast("No se pudo eliminar: " + e.message, true);
    }
  }, []);

  const resetToSeed = useCallback(async () => {
    try {
      for (const p of seedProducts()) await db.upsertProduct({ ...p, visible: true });
      adminToast("Catálogo restablecido.");
    } catch (e) {
      adminToast("No se pudo restablecer: " + e.message, true);
    }
  }, []);

  return { products, add, update, remove, resetToSeed };
}

// ── Stock ─────────────────────────────────────────────────
export function useStock() {
  const [stock, setStockState] = useState(() => ({ ...db.getStockMap() }));
  useEffect(() => db.subscribe(() => setStockState({ ...db.getStockMap() })), []);

  const set = useCallback(async (pid, sz, qty) => {
    try {
      await db.setStock(pid, sz, qty);
    } catch (e) {
      adminToast("No se pudo guardar el stock: " + e.message, true);
    }
  }, []);
  const get = useCallback(
    (pid, sz) => {
      const v = stock[`${pid}::${sz}`];
      return v === undefined ? "" : v;
    },
    [stock]
  );
  const reset = useCallback(async () => {
    try {
      await db.clearStock();
      adminToast("Stock limpiado.");
    } catch (e) {
      adminToast("No se pudo limpiar el stock: " + e.message, true);
    }
  }, []);
  return { stock, set, get, reset };
}

// ── Configuración (settings) ──────────────────────────────
export function useCfg() {
  const read = () => ({
    wa_phone: db.getSetting("wa_phone", DEFAULT_WA_PHONE) || DEFAULT_WA_PHONE,
    bot_daily_limit: parseInt(db.getSetting("bot_daily_limit", "10") || "10") || 10,
  });
  const [cfg, setCfg] = useState(read);
  useEffect(() => db.subscribe(() => setCfg(read())), []);
  const save = useCallback(async (patch) => {
    try {
      for (const [k, v] of Object.entries(patch)) await db.saveSetting(k, String(v));
      adminToast("Configuración guardada.");
    } catch (e) {
      adminToast("No se pudo guardar: " + e.message, true);
    }
  }, []);
  return { cfg, save };
}

// ── Estadísticas de negocio (dashboard Inicio) ────────────
// Carga wa_orders + cart_quotes una vez (mismo patrón que TabDespachos:
// sin canal realtime, con `reload` manual) y deja los agregados listos.
export function useOrdersStats() {
  const [orders, setOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, q] = await Promise.all([db.getOrders(), db.getQuotes()]);
      setOrders(o);
      setQuotes(q);
    } catch (e) {
      adminToast("No se pudieron cargar las estadísticas: " + e.message, true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const active = orders.filter((o) => o.status !== "cancelled");

    const revenueMonth = active
      .filter((o) => new Date(o.created_at) >= monthStart)
      .reduce((s, o) => s + Number(o.total || 0), 0);
    const avgTicket = active.length
      ? active.reduce((s, o) => s + Number(o.total || 0), 0) / active.length
      : 0;

    const statusCounts = {};
    for (const o of orders) {
      const k = o.status || "pending";
      statusCounts[k] = (statusCounts[k] || 0) + 1;
    }

    // Serie de ingresos por día — últimos 30 días.
    const dayKey = (d) => d.toISOString().slice(0, 10);
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });
    const byDay = {};
    for (const o of active) {
      const k = dayKey(new Date(o.created_at));
      byDay[k] = (byDay[k] || 0) + Number(o.total || 0);
    }
    const revenueSeries = days.map((d) => ({
      label: d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" }),
      value: byDay[dayKey(d)] || 0,
    }));

    // Conversión cotización → pedido: una cotización cuenta como convertida
    // si quedó marcada `used` o si algún pedido referencia su `quote_code`.
    const quoteCodes = new Set(orders.map((o) => o.quote_code).filter(Boolean));
    const convertedQuotes = quotes.filter((q) => q.used || quoteCodes.has(q.code)).length;
    const conversionRate = quotes.length ? (convertedQuotes / quotes.length) * 100 : null;

    // Rendimiento de descuentos: total otorgado por código (pedidos activos).
    const discountTotals = {};
    for (const o of active) {
      if (!o.discount_code) continue;
      discountTotals[o.discount_code] = (discountTotals[o.discount_code] || 0) + Number(o.discount_amount || 0);
    }

    return {
      revenueMonth,
      avgTicket,
      pendingCount: statusCounts.pending || 0,
      statusCounts,
      revenueSeries,
      conversionRate,
      quotesTotal: quotes.length,
      discountTotals,
      recentOrders: orders.slice(0, 5),
    };
  }, [orders, quotes]);

  return { ...stats, loading, reload: load };
}

// ── Badges (contadores del sidebar) ───────────────────────
export function useChatBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const recompute = async () => {
      try {
        await db.loadThreads();
        const th = db.getThreads();
        const n = Object.values(th).filter((t) => t.needs_human).length;
        if (alive) setCount(n);
      } catch {}
    };
    recompute();
    const unsub = db.subscribeChats(() => recompute());
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  return count;
}

export function useDespBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    db.getOrders("pending")
      .then((data) => {
        if (alive) setCount(data.length);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return count;
}
