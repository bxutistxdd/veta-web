/* VETA admin · pestaña Inicio (dashboard de negocio: ventas, pedidos,
   conversión de cotizaciones, rendimiento de descuentos e inventario). */

import { useState, useEffect } from "react";
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

const fmt = (n) => VETA_DATA.fmtPrice(n || 0);

export function TabInicio({ products, stock }) {
  const {
    revenueMonth,
    avgTicket,
    pendingCount,
    statusCounts,
    revenueSeries,
    conversionRate,
    quotesTotal,
    discountTotals,
    recentOrders,
    loading,
  } = useOrdersStats();

  const [discountCodes, setDiscountCodes] = useState(() => db.getDiscountCodes());
  useEffect(() => db.subscribe(() => setDiscountCodes(db.getDiscountCodes().slice())), []);

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
      <div className="adm-stats-grid">
        <div className="adm-stat">
          <span className="adm-stat-n">{fmt(revenueMonth)}</span>
          <span className="adm-stat-l">Ingresos del mes</span>
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
          <h3 className="adm-sub-h">Pedidos por estado</h3>
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
