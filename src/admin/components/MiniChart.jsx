/* VETA admin · gráficos SVG livianos, sin dependencias externas.
   Pensados para volúmenes chicos (decenas/cientos de puntos) — solo dibujan,
   no agregan datos; el cálculo de series vive en cada tab que los usa. */

// points: [{ label, value }]. Dibuja una línea con área rellena.
export function MiniLineChart({ points, height = 120, formatValue }) {
  const w = 320;
  const h = height;
  const pad = 8;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (p.value / max) * (h - pad * 2);
    return [x, y];
  });
  const linePath = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const areaPath =
    xy.length > 0
      ? `${linePath} L${xy[xy.length - 1][0]},${h - pad} L${xy[0][0]},${h - pad} Z`
      : "";
  const last = points[points.length - 1];

  return (
    <div className="adm-chart">
      <svg viewBox={`0 0 ${w} ${h}`} className="adm-chart-svg" preserveAspectRatio="none">
        {areaPath && <path d={areaPath} className="adm-chart-area" />}
        {linePath && <path d={linePath} className="adm-chart-line" />}
      </svg>
      <div className="adm-chart-foot">
        <span>{points[0]?.label}</span>
        {last && (
          <span className="adm-chart-foot-last">
            {formatValue ? formatValue(last.value) : last.value} · {last.label}
          </span>
        )}
      </div>
    </div>
  );
}

// bars: [{ label, value, warn? }]. Barras horizontales con etiqueta y valor.
export function MiniBarChart({ bars, formatValue }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="adm-chart-bars">
      {bars.map((b) => (
        <div className="adm-chart-bar-row" key={b.label}>
          <span className="adm-chart-bar-label">{b.label}</span>
          <div className="adm-chart-bar-track">
            <div
              className={`adm-chart-bar-fill${b.warn ? " adm-chart-bar-fill--warn" : ""}`}
              style={{ width: `${(b.value / max) * 100}%` }}
            />
          </div>
          <span className="adm-chart-bar-value">
            {formatValue ? formatValue(b.value) : b.value}
          </span>
        </div>
      ))}
    </div>
  );
}
