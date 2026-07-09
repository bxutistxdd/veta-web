/* VETA admin · pestaña Inicio (resumen: totales, stock, productos por categoría). */

import { db } from "../../lib/db.js";

export function TabInicio({ products, stock }) {
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

  return (
    <div className="adm-page">
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
      <h3 className="adm-sub-h">Por categoría</h3>
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
