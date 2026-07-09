/* VETA admin · pestaña Stock (matriz editable de existencias por talla). */

import { useState } from "react";
import { VETA_DATA } from "../../lib/data.js";
import { db } from "../../lib/db.js";

// Celda editable: clic para escribir la cantidad; vacío = "sin definir".
function StockCell({ pid, sz, get, set }) {
  const val = get(pid, sz);
  const [edit, setEdit] = useState(false);
  const [local, setLocal] = useState("");
  const cls =
    val === ""
      ? "adm-sc--nd"
      : val === 0
        ? "adm-sc--zero"
        : val <= 2
          ? "adm-sc--low"
          : "adm-sc--ok";
  const commit = () => {
    const s = local.trim();
    if (s === "") set(pid, sz, -1);
    else {
      const n = parseInt(s, 10);
      if (!isNaN(n) && n >= 0) set(pid, sz, n);
    }
    setEdit(false);
  };
  if (edit)
    return (
      <input
        type="number"
        min="0"
        className="adm-sc-inp"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEdit(false);
        }}
        autoFocus
      />
    );
  return (
    <button
      className={`adm-sc ${cls}`}
      title="Clic para editar"
      onClick={() => {
        setLocal(val === "" ? "" : String(val));
        setEdit(true);
      }}
    >
      {val === "" ? "—" : val}
    </button>
  );
}

export function TabStock({ products, get, set, reset }) {
  const [cat, setCat] = useState("todas");
  const cats = ["todas", ...(db.getCategories(1) || VETA_DATA.categories).map((c) => c.id)];
  const filtered = cat === "todas" ? products : products.filter((p) => p.cat === cat);
  return (
    <div className="adm-page">
      <div className="adm-toolbar">
        <div className="adm-pills">
          {cats.map((c) => (
            <button
              key={c}
              className={`adm-pill${cat === c ? " adm-pill--on" : ""}`}
              onClick={() => setCat(c)}
              style={{ textTransform: "capitalize" }}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          className="adm-btn adm-btn--ghost adm-btn--sm"
          onClick={() => window.confirm("¿Limpiar todo el stock definido?") && reset()}
        >
          Limpiar todo
        </button>
      </div>
      <p className="adm-legend-row">
        <span>Leyenda:</span>
        <span className="adm-sc adm-sc--ok" style={{ pointerEvents: "none" }}>
          4+
        </span>
        <span>Disponible</span>
        <span className="adm-sc adm-sc--low" style={{ pointerEvents: "none" }}>
          ≤2
        </span>
        <span>Stock bajo</span>
        <span className="adm-sc adm-sc--zero" style={{ pointerEvents: "none" }}>
          0
        </span>
        <span>Agotado</span>
        <span className="adm-sc adm-sc--nd" style={{ pointerEvents: "none" }}>
          —
        </span>
        <span>Sin definir</span>
      </p>
      <div className="adm-stock-list">
        {filtered.map((p) => (
          <div key={p.id} className="adm-stock-row">
            <div className="adm-stock-prod">
              <span className="adm-stock-name">{p.name}</span>
              <span className="adm-stock-meta">
                <code className="adm-code">{p.id}</code>
                <span style={{ textTransform: "capitalize" }}>{p.cat}</span>
              </span>
            </div>
            <div className="adm-stock-sizes">
              {p.sizes.map((sz) => (
                <div key={sz} className="adm-size-item">
                  <span className="adm-size-lbl">{sz}</span>
                  <StockCell pid={p.id} sz={sz} get={get} set={set} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
