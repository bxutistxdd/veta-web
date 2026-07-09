/* VETA admin · pestaña Descuentos (lista + toggles de activo/visible + CRUD).
   Vista de tabla en desktop y tarjetas en móvil. */

import { useState, useEffect, useCallback } from "react";
import { VETA_DATA } from "../../lib/data.js";
import { db } from "../../lib/db.js";
import { adminToast } from "../toast.jsx";
import { DiscountForm } from "../forms/DiscountForm.jsx";

function useDiscountCodes() {
  const [codes, setCodes] = useState(() => db.getDiscountCodes());
  useEffect(() => db.subscribe(() => setCodes(db.getDiscountCodes().slice())), []);

  const upsert = useCallback(async (data) => {
    try {
      await db.upsertDiscountCode(data);
      adminToast(data.id ? "Código guardado." : "Código creado.");
      return true;
    } catch (e) {
      adminToast("No se pudo guardar: " + e.message, true);
      return false;
    }
  }, []);

  const remove = useCallback(async (id) => {
    try {
      await db.deleteDiscountCode(id);
      adminToast("Código eliminado.");
    } catch (e) {
      adminToast("No se pudo eliminar: " + e.message, true);
    }
  }, []);

  const toggleActive = useCallback(async (code) => {
    try {
      await db.upsertDiscountCode({ ...code, id: code.id, active: !code.active });
    } catch (e) {
      adminToast("No se pudo cambiar: " + e.message, true);
    }
  }, []);

  const toggleShowOnSite = useCallback(async (code) => {
    try {
      await db.upsertDiscountCode({ ...code, id: code.id, show_on_site: !code.show_on_site });
    } catch (e) {
      adminToast("No se pudo cambiar: " + e.message, true);
    }
  }, []);

  return { codes, upsert, remove, toggleActive, toggleShowOnSite };
}

export function TabDescuentos() {
  const { codes, upsert, remove, toggleActive, toggleShowOnSite } = useDiscountCodes();
  const [view, setView] = useState("list"); // "list" | "new" | <code-obj>
  const [confirm, setConfirm] = useState(null); // id a eliminar

  if (view === "new" || (view && typeof view === "object")) {
    return (
      <DiscountForm
        initial={typeof view === "object" ? view : null}
        onSave={upsert}
        onCancel={() => setView("list")}
      />
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-toolbar">
        <p className="adm-hint" style={{ margin: 0, flex: 1 }}>
          Crea códigos que tus clientes ingresan en la bolsa para obtener descuento.
        </p>
        <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setView("new")}>
          + Nuevo código
        </button>
      </div>

      {codes.length === 0 ? (
        <p className="adm-empty">Aún no hay códigos. ¡Crea el primero!</p>
      ) : (
        <>
          {/* Vista desktop: tabla */}
          <div className="adm-table-wrap adm-disc-table-wrap">
            <table className="adm-table adm-table--disc">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Descuento</th>
                  <th>Usos</th>
                  <th>Vence</th>
                  <th>Activo</th>
                  <th>En sitio</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => {
                  const expired = c.expires_at && new Date(c.expires_at) < new Date();
                  const exhausted = c.max_uses !== null && c.uses_count >= c.max_uses;
                  return (
                    <tr
                      key={c.id}
                      className={!c.active || expired || exhausted ? "adm-row--dim" : ""}
                    >
                      <td>
                        <code className="adm-code adm-disc-code">{c.code}</code>
                      </td>
                      <td style={{ color: "var(--ink-soft)", fontSize: 13 }}>
                        {c.description || "—"}
                      </td>
                      <td>
                        <span className="adm-disc-value">
                          {c.type === "percent" ? `${c.value}%` : VETA_DATA.fmtPrice(c.value)}
                          {" OFF"}
                          {c.min_subtotal > 0 && (
                            <span className="adm-disc-min">
                              {" "}
                              (min {VETA_DATA.fmtPrice(c.min_subtotal)})
                            </span>
                          )}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                        {c.uses_count}
                        {c.max_uses !== null ? ` / ${c.max_uses}` : ""}
                        {exhausted && (
                          <span style={{ color: "#c0392b", marginLeft: 4 }}>Agotado</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: expired ? "#c0392b" : "var(--ink-soft)" }}>
                        {c.expires_at
                          ? new Date(c.expires_at).toLocaleDateString("es-CO")
                          : "Sin vencimiento"}
                        {expired && " ⚠"}
                      </td>
                      <td>
                        <button
                          className={`adm-badge${c.active ? " adm-badge--on" : ""}`}
                          onClick={() => toggleActive(c)}
                        >
                          {c.active ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td>
                        <button
                          className={`adm-badge${c.show_on_site ? " adm-badge--on" : ""}`}
                          onClick={() => toggleShowOnSite(c)}
                        >
                          {c.show_on_site ? "Visible" : "Oculto"}
                        </button>
                      </td>
                      <td>
                        <div className="adm-row-actions">
                          <button
                            className="adm-action-btn"
                            onClick={() => setView(c)}
                            title="Editar"
                          >
                            ✏
                          </button>
                          {confirm === c.id ? (
                            <span className="adm-disc-confirm-inline">
                              <button className="adm-action-btn" onClick={() => setConfirm(null)}>
                                ✗
                              </button>
                              <button
                                className="adm-action-btn adm-action-btn--del"
                                onClick={() => {
                                  remove(c.id);
                                  setConfirm(null);
                                }}
                              >
                                ✓
                              </button>
                            </span>
                          ) : (
                            <button
                              className="adm-action-btn adm-action-btn--del"
                              onClick={() => setConfirm(c.id)}
                              title="Eliminar"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista móvil: tarjetas */}
          <div className="adm-disc-cards">
            {codes.map((c) => {
              const expired = c.expires_at && new Date(c.expires_at) < new Date();
              const exhausted = c.max_uses !== null && c.uses_count >= c.max_uses;
              return (
                <div
                  key={c.id}
                  className={`adm-disc-card${!c.active || expired || exhausted ? " adm-disc-card--dim" : ""}`}
                >
                  <div className="adm-disc-card-top">
                    <code className="adm-code adm-disc-code">{c.code}</code>
                    <span className="adm-disc-value">
                      {c.type === "percent" ? `${c.value}%` : VETA_DATA.fmtPrice(c.value)} OFF
                    </span>
                  </div>
                  {c.description && <p className="adm-disc-card-desc">{c.description}</p>}
                  <div className="adm-disc-card-row">
                    <button
                      className={`adm-badge${c.active ? " adm-badge--on" : ""}`}
                      onClick={() => toggleActive(c)}
                    >
                      {c.active ? "Activo" : "Inactivo"}
                    </button>
                    <button
                      className={`adm-badge${c.show_on_site ? " adm-badge--on" : ""}`}
                      onClick={() => toggleShowOnSite(c)}
                    >
                      {c.show_on_site ? "Visible" : "Oculto"}
                    </button>
                    <div className="adm-row-actions" style={{ marginLeft: "auto" }}>
                      <button className="adm-action-btn" onClick={() => setView(c)} title="Editar">
                        ✏
                      </button>
                      {confirm === c.id ? (
                        <span className="adm-disc-confirm-inline">
                          <button className="adm-action-btn" onClick={() => setConfirm(null)}>
                            ✗
                          </button>
                          <button
                            className="adm-action-btn adm-action-btn--del"
                            onClick={() => {
                              remove(c.id);
                              setConfirm(null);
                            }}
                          >
                            ✓
                          </button>
                        </span>
                      ) : (
                        <button
                          className="adm-action-btn adm-action-btn--del"
                          onClick={() => setConfirm(c.id)}
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  {(c.uses_count > 0 || c.max_uses !== null || c.expires_at) && (
                    <p className="adm-disc-card-meta">
                      {c.uses_count > 0 || c.max_uses !== null
                        ? `Usos: ${c.uses_count}${c.max_uses !== null ? ` / ${c.max_uses}` : ""}`
                        : ""}
                      {exhausted && " · Agotado"}
                      {c.expires_at &&
                        ` · Vence: ${new Date(c.expires_at).toLocaleDateString("es-CO")}`}
                      {expired && " ⚠"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="adm-note" style={{ marginTop: 16 }}>
        <strong>Tip:</strong> Los códigos con <em>"Mostrar en sitio"</em> activo aparecen como un
        banner en la tienda para todos los visitantes. Úsalo para promociones públicas. Para códigos
        privados (descuentos a clientes específicos), deja esa opción inactiva.
      </div>
    </div>
  );
}
