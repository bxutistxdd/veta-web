/* VETA admin · pestaña Productos (CRUD, búsqueda, filtro por categoría,
   modo de destacados y toggles de visibilidad/destacado). */

import { useState, useEffect } from "react";
import { VETA_DATA } from "../../lib/data.js";
import { db } from "../../lib/db.js";
import { adminToast } from "../toast.jsx";
import { PHShape } from "../../components/primitives.jsx";
import { ProductForm } from "../forms/ProductForm.jsx";

export function TabProductos({
  products,
  addProduct,
  updateProduct,
  removeProduct,
  toggleHidden,
  toggleFeatured,
}) {
  const [view, setView] = useState("list"); // "list" | "new" | <product-obj>
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("todas");
  const [featuredMode, setFeaturedMode] = useState(
    () => db.getSetting("featured_mode", "auto") || "auto"
  );

  useEffect(
    () =>
      db.subscribe(() => {
        setFeaturedMode(db.getSetting("featured_mode", "auto") || "auto");
      }),
    []
  );

  const changeFeaturedMode = async (m) => {
    try {
      await db.saveSetting("featured_mode", m);
    } catch (e) {
      adminToast("No se pudo cambiar el modo de destacados: " + e.message, true);
    }
  };

  const cats = ["todas", ...(db.getCategories(1) || VETA_DATA.categories).map((c) => c.id)];
  const filtered = products.filter((p) => {
    const mq = !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.id.includes(q);
    const mc = cat === "todas" || p.cat === cat;
    return mq && mc;
  });

  const handleDelete = (p) => {
    if (window.confirm(`¿Eliminar "${p.name}"? No se puede deshacer.`)) removeProduct(p.id);
  };

  // Mostrar formulario
  if (view === "new" || (view && typeof view === "object")) {
    return (
      <ProductForm
        product={typeof view === "object" ? view : null}
        allProducts={products}
        onSave={(data) => {
          if (typeof view === "object") updateProduct(data.id, data);
          else addProduct(data);
          setView("list");
        }}
        onBack={() => setView("list")}
      />
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-toolbar">
        <input
          className="adm-input adm-input--sm"
          placeholder="Buscar producto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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
          className="adm-btn adm-btn--primary adm-btn--sm"
          style={{ marginLeft: "auto" }}
          onClick={() => setView("new")}
        >
          + Nuevo producto
        </button>
      </div>

      <div className="adm-toolbar">
        <span className="adm-hint" style={{ margin: 0 }}>
          Destacados del inicio:
        </span>
        <div className="adm-pills">
          <button
            className={`adm-pill${featuredMode === "auto" ? " adm-pill--on" : ""}`}
            onClick={() => changeFeaturedMode("auto")}
            title="El sitio elige 4-6 productos al azar cada día, priorizando los marcados Destacado: Sí"
          >
            🎲 Aleatorio
          </button>
          <button
            className={`adm-pill${featuredMode === "manual" ? " adm-pill--on" : ""}`}
            onClick={() => changeFeaturedMode("manual")}
            title='Se muestran en el inicio exactamente los productos marcados "Destacado: Sí" abajo'
          >
            🎯 Tomar control
          </button>
        </div>
        {featuredMode === "manual" && (
          <span className="adm-hint" style={{ margin: 0 }}>
            Se muestran los marcados "Destacado: Sí" ({products.filter((p) => p.featured).length}/6
            recomendado).
          </span>
        )}
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Img.</th>
              <th>Nombre</th>
              <th>Cat.</th>
              <th>Material</th>
              <th>Precio</th>
              <th>Tallas</th>
              <th>Estado</th>
              <th>Destacado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={p.hidden ? "adm-row--dim" : ""}>
                <td>
                  <div className="adm-prod-thumb">
                    {VETA_DATA.productImages(p)[0] ? (
                      <img src={VETA_DATA.productImages(p)[0]} alt={p.name} />
                    ) : (
                      <PHShape kind={VETA_DATA.shapes[p.cat]?.kind || "ring"} />
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                  <code className="adm-code">{p.id}</code>
                </td>
                <td style={{ textTransform: "capitalize", color: "var(--ink-soft)" }}>{p.cat}</td>
                <td style={{ color: "var(--ink-soft)" }}>{p.material}</td>
                <td>{VETA_DATA.fmtPrice(p.price)}</td>
                <td className="adm-sizes-cell">{p.sizes.join(" · ")}</td>
                <td>
                  <button
                    className={`adm-badge${p.hidden ? "" : " adm-badge--on"}`}
                    onClick={() => toggleHidden(p.id)}
                  >
                    {p.hidden ? "Oculto" : "Visible"}
                  </button>
                </td>
                <td>
                  <button
                    className={`adm-badge${p.featured ? " adm-badge--on" : ""}`}
                    onClick={() => toggleFeatured(p.id)}
                    title="Elegible para destacados del Home"
                  >
                    {p.featured ? "Sí" : "No"}
                  </button>
                </td>
                <td>
                  <div className="adm-row-actions">
                    <button className="adm-action-btn" onClick={() => setView(p)} title="Editar">
                      ✏
                    </button>
                    <button
                      className="adm-action-btn adm-action-btn--del"
                      onClick={() => handleDelete(p)}
                      title="Eliminar"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="adm-empty">
            {q ? `Sin resultados para "${q}".` : "No hay productos. ¡Agrega el primero!"}
          </p>
        )}
      </div>
    </div>
  );
}
