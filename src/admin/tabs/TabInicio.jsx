/* VETA admin · pestaña Inicio (dashboard de negocio: ventas, pedidos,
   conversión de cotizaciones, rendimiento de descuentos e inventario). */

import { useState, useEffect, useMemo } from "react";
import { db } from "../../lib/db.js";
import { VETA_DATA } from "../../lib/data.js";
import { useOrdersStats } from "../hooks.js";
import { MiniLineChart, MiniBarChart } from "../components/MiniChart.jsx";

const STATUS_LABELS = {
  pending: "Pendiente",
  dispatched: "Despachado",
  delivered: "Entregado",
  problem: "⚠ Problema",
  cancelled: "Cancelado",
};
const STATUS_ORDER = ["pending", "dispatched", "delivered", "problem", "cancelled"];

const RANGE_OPTIONS = [
  { id: "today", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "month", label: "Este mes" },
  { id: "all", label: "Todo" },
];

const fmt = (n) => VETA_DATA.fmtPrice(n || 0);

function rangeStart(rangeId, now) {
  if (rangeId === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (rangeId === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (rangeId === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return null; // "all"
}

export function TabInicio({ products, stock }) {
  const { orders, quotes, loading, reload } = useOrdersStats();
  const [range, setRange] = useState("month");
  const [statusFilter, setStatusFilter] = useState("all");

  const [discountCodes, setDiscountCodes] = useState(() => db.getDiscountCodes());
  useEffect(() => db.subscribe(() => setDiscountCodes(db.getDiscountCodes().slice())), []);

  const stats = useMemo(() => {
    const now = new Date();
    const from = rangeStart(range, now);
    const inRange = (o) => !from || new Date(o.created_at) >= from;

    const ordersInRange = orders.filter(inRange);
    const active = ordersInRange.filter((o) => o.status !== "cancelled");
    const filtered = statusFilter === "all" ? active : active.filter((o) => o.status === statusFilter);

    const revenue = filtered.reduce((s, o) => s + Number(o.total || 0), 0);
    const avgTicket = filtered.length ? revenue / filtered.length : 0;

    // El desglose por estado ignora el filtro de estado (para no vaciarse a sí mismo)
    // pero respeta el rango de fecha elegido.
    const statusCounts = {};
    for (const o of ordersInRange) {
      const k = o.status || "pending";
      statusCounts[k] = (statusCounts[k] || 0) + 1;
    }

    // Serie de ingresos por día — últimos 30 días (independiente del filtro de rango,
    // siempre da contexto de tendencia reciente), respeta el filtro de estado.
    const dayKey = (d) => d.toISOString().slice(0, 10);
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });
    const seriesSource =
      statusFilter === "all"
        ? orders.filter((o) => o.status !== "cancelled")
        : orders.filter((o) => o.status === statusFilter);
    const byDay = {};
    for (const o of seriesSource) {
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

    // Rendimiento de descuentos: total otorgado por código, dentro del rango/estado elegidos.
    const discountTotals = {};
    for (const o of filtered) {
      if (!o.discount_code) continue;
      discountTotals[o.discount_code] =
        (discountTotals[o.discount_code] || 0) + Number(o.discount_amount || 0);
    }

    return {
      revenue,
      avgTicket,
      pendingCount: statusCounts.pending || 0,
      statusCounts,
      revenueSeries,
      conversionRate,
      quotesTotal: quotes.length,
      discountTotals,
      recentOrders: filtered.slice(0, 5),
    };
  }, [orders, quotes, range, statusFilter]);

  const {
    revenue,
    avgTicket,
    pendingCount,
    statusCounts,
    revenueSeries,
    conversionRate,
    quotesTotal,
    discountTotals,
    recentOrders,
  } = stats;

  const total = products.length;
  const visible = products.filter((p) => !p.hidden).length;
  const ocultos = total - visible;
  const stEntries = Object.entries(stock);
  const agotados = stEntries.filter(([, v]) => v === 0).length;
  const bajos = stEntries.filter(([, v]) => v > 0 && v <= 2).length;
  const bycat = {};
  products.forEach((p) => {
    bycat[p.cat] = (bycat[p.cat] || 0) + 1;
  });

  const statusBars = STATUS_ORDER.filter((s) => statusCounts[s]).map((s) => ({
    label: STATUS_LABELS[s],
    value: statusCounts[s],
    warn: s === "problem",
  }));

  const discountRows = discountCodes
    .map((c) => ({
      code: c.code,
      uses: c.uses_count || 0,
      maxUses: c.max_uses,
      totalDiscount: discountTotals[c.code] || 0,
    }))
    .filter((r) => r.uses > 0 || r.totalDiscount > 0);

  return (
    <div className="adm-page">
      <div className="adm-inicio-toolbar">
        <div className="adm-seg">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.id}
              className={`adm-seg-btn${range === r.id ? " adm-seg-btn--on" : ""}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <select
          className="adm-input adm-inicio-status-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrar por estado de pedido"
        >
          <option value="all">Todos los estados</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button className="adm-btn adm-btn--ghost" onClick={reload} disabled={loading}>
          {loading ? "Recargando…" : "↻ Recargar"}
        </button>
      </div>

      <div className="adm-stats-grid">
        <div className="adm-stat">
          <span className="adm-stat-n">{fmt(revenue)}</span>
          <span className="adm-stat-l">Ingresos · {RANGE_OPTIONS.find((r) => r.id === range)?.label}</span>
        </div>
        <div className={`adm-stat${pendingCount > 0 ? " adm-stat--warn" : ""}`}>
          <span className="adm-stat-n">{pendingCount}</span>
          <span className="adm-stat-l">Pedidos pendientes</span>
        </div>
        <div className="adm-stat">
          <span className="adm-stat-n">{fmt(avgTicket)}</span>
          <span className="adm-stat-l">Ticket promedio</span>
        </div>
        <div className="adm-stat">
          <span className="adm-stat-n">
            {conversionRate === null ? "—" : `${conversionRate.toFixed(0)}%`}
          </span>
          <span className="adm-stat-l">
            Conversión cotización → pedido{quotesTotal > 0 ? ` (${quotesTotal})` : ""}
          </span>
        </div>
      </div>

      {!loading && revenueSeries.some((p) => p.value > 0) && (
        <>
          <h3 className="adm-sub-h">Ingresos · últimos 30 días</h3>
          <MiniLineChart points={revenueSeries} formatValue={fmt} />
        </>
      )}

      {!loading && statusBars.length > 0 && (
        <>
          <h3 className="adm-sub-h">
            Pedidos por estado · {RANGE_OPTIONS.find((r) => r.id === range)?.label}
          </h3>
          <MiniBarChart bars={statusBars} />
        </>
      )}

      {!loading && recentOrders.length > 0 && (
        <>
          <h3 className="adm-sub-h">Últimos pedidos</h3>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.customer_name || "Cliente"}</td>
                    <td>{fmt(o.total)}</td>
                    <td>{STATUS_LABELS[o.status] || o.status}</td>
                    <td>{new Date(o.created_at).toLocaleDateString("es-CO")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && recentOrders.length === 0 && (
        <p className="adm-note">No hay pedidos que coincidan con el filtro elegido.</p>
      )}

      {discountRows.length > 0 && (
        <>
          <h3 className="adm-sub-h">Rendimiento de descuentos</h3>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Usos</th>
                  <th>Total descontado</th>
                </tr>
              </thead>
              <tbody>
                {discountRows.map((r) => (
                  <tr key={r.code}>
                    <td>{r.code}</td>
                    <td>
                      {r.uses}
                      {r.maxUses ? ` / ${r.maxUses}` : ""}
                    </td>
                    <td>{fmt(r.totalDiscount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className="adm-sub-h">Inventario</h3>
      <div className="adm-stats-grid">
        <div className="adm-stat">
          <span className="adm-stat-n">{total}</span>
          <span className="adm-stat-l">Total productos</span>
        </div>
        <div className="adm-stat">
          <span className="adm-stat-n">{visible}</span>
          <span className="adm-stat-l">Visibles en tienda</span>
        </div>
        <div className="adm-stat">
          <span className="adm-stat-n">{ocultos}</span>
          <span className="adm-stat-l">Ocultos</span>
        </div>
        <div className={`adm-stat${agotados > 0 ? " adm-stat--warn" : ""}`}>
          <span className="adm-stat-n">{agotados}</span>
          <span className="adm-stat-l">Agotados (0 und.)</span>
        </div>
        <div className={`adm-stat${bajos > 0 ? " adm-stat--warn" : ""}`}>
          <span className="adm-stat-n">{bajos}</span>
          <span className="adm-stat-l">Stock bajo (≤2 und.)</span>
        </div>
      </div>
      <div className="adm-card">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Productos</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(bycat).map(([cat, n]) => (
              <tr key={cat}>
                <td style={{ textTransform: "capitalize" }}>{db.getCategoryLabel(cat) || cat}</td>
                <td>{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {agotados > 0 && (
        <div className="adm-alert">
          ⚠ {agotados} talla(s) con stock en cero. Revisa la pestaña <strong>Stock</strong>.
        </div>
      )}
      <p className="adm-note">
        <strong>En vivo:</strong> los datos se guardan en Supabase y se reflejan en la tienda al
        instante, desde cualquier dispositivo.
      </p>
    </div>
  );
}
