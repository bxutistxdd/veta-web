/* VETA admin · pestaña Categorías (jerarquía Categoría → Subcategoría →
   Referencia) con editor modal y borrado en cascada. */

import { useState, useEffect, useRef } from "react";
import { VETA_DATA } from "../../lib/data.js";
import { db } from "../../lib/db.js";
import { adminToast } from "../toast.jsx";
import { slugify } from "../images.js";

const CAT_LEVEL_LABEL = { 1: "categoría", 2: "subcategoría", 3: "referencia" };

function CatEditor({ editing, onSave, onCancel }) {
  const [label, setLabel] = useState(editing.label || "");
  const [blurb, setBlurb] = useState(editing.blurb || "");
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  const lvlName = CAT_LEVEL_LABEL[editing.level] || "categoría";
  return (
    <div className="adm-modal-ov" onClick={onCancel}>
      <div className="adm-crop" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <h3 className="adm-form-card-h" style={{ textTransform: "capitalize" }}>
          {editing.mode === "new" ? `Nueva ${lvlName}` : `Editar ${lvlName}`}
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(label, blurb);
          }}
        >
          <div className="adm-form-field">
            <label className="adm-lbl">
              Nombre <span className="adm-required">*</span>
            </label>
            <input
              ref={ref}
              className="adm-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={
                editing.level === 3
                  ? "Ej: Herradura con esmeralda"
                  : editing.level === 2
                    ? "Ej: Trenzado"
                    : "Ej: Anillos Plata"
              }
            />
          </div>
          <div className="adm-form-field" style={{ marginTop: 10 }}>
            <label className="adm-lbl">
              Descripción <span className="adm-field-hint-inline">— opcional</span>
            </label>
            <input
              className="adm-input"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="Frase corta que describe esta categoría"
            />
          </div>
          <div className="adm-form-actions" style={{ marginTop: 16 }}>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="adm-btn adm-btn--primary">
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TabCategorias() {
  const [, force] = useState(0);
  useEffect(() => db.subscribe(() => force((n) => n + 1)), []);
  const [editing, setEditing] = useState(null); // { mode, level, parentId, id?, label, blurb }

  const all = db.getCategories() || VETA_DATA.categories;
  const byParent = (pid) =>
    all.filter((c) => c.parent_id === pid).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const cats = all.filter((c) => c.level === 1).sort((a, b) => (a.sort || 0) - (b.sort || 0));

  const save = async (label, blurb) => {
    const lbl = (label || "").trim();
    if (!lbl) {
      adminToast("El nombre es obligatorio.", true);
      return;
    }
    try {
      if (editing.mode === "edit") {
        const ex = all.find((c) => c.id === editing.id) || {};
        await db.upsertCategory({
          id: editing.id,
          parent_id: editing.parentId || null,
          level: editing.level,
          label: lbl,
          blurb: (blurb || "").trim(),
          prefix: ex.prefix || null,
          sort: ex.sort || 0,
        });
      } else {
        const base = slugify(lbl) || "cat";
        let slug = editing.level === 1 ? base : `${editing.parentId}-${base}`;
        let cand = slug,
          n = 2;
        while (all.some((c) => c.id === cand)) cand = `${slug}-${n++}`;
        const siblings = editing.level === 1 ? cats : byParent(editing.parentId);
        await db.upsertCategory({
          id: cand,
          parent_id: editing.parentId || null,
          level: editing.level,
          label: lbl,
          blurb: (blurb || "").trim(),
          prefix: editing.level === 1 ? base.slice(0, 2) : null,
          sort: siblings.length + 1,
        });
      }
      adminToast("Categoría guardada.");
      setEditing(null);
    } catch (e) {
      adminToast("No se pudo guardar: " + e.message, true);
    }
  };

  const del = async (c) => {
    const childCount = all.filter((x) => x.parent_id === c.id).length;
    const prodCount = db.countProductsInCategory(c.id);
    let msg = `¿Eliminar "${c.label}"?`;
    if (childCount) msg += ` Se eliminarán también sus ${childCount} sub-elemento(s).`;
    if (prodCount) msg += ` ${prodCount} producto(s) quedarán sin esta clasificación.`;
    if (!window.confirm(msg)) return;
    try {
      await db.deleteCategory(c.id);
      adminToast("Categoría eliminada.");
    } catch (e) {
      adminToast("No se pudo eliminar: " + e.message, true);
    }
  };

  return (
    <div className="adm-page">
      <div className="adm-toolbar">
        <span className="adm-hint" style={{ margin: 0 }}>
          Organiza el catálogo en 3 niveles: <strong>Categoría → Subcategoría → Referencia</strong>.
        </span>
        <button
          className="adm-btn adm-btn--primary adm-btn--sm"
          style={{ marginLeft: "auto" }}
          onClick={() => setEditing({ mode: "new", level: 1, parentId: null })}
        >
          + Nueva categoría
        </button>
      </div>

      <div className="adm-cat-tree">
        {cats.length === 0 && <p className="adm-empty">No hay categorías. Crea la primera.</p>}
        {cats.map((c) => (
          <div key={c.id} className="adm-cat-node adm-cat-node--1">
            <div className="adm-cat-row">
              <span className="adm-cat-label">{c.label}</span>
              {c.blurb && <span className="adm-cat-blurb">{c.blurb}</span>}
              <div className="adm-cat-row-actions">
                <button
                  className="adm-mini-btn"
                  onClick={() => setEditing({ mode: "new", level: 2, parentId: c.id })}
                >
                  + Subcategoría
                </button>
                <button
                  className="adm-action-btn"
                  title="Editar"
                  onClick={() =>
                    setEditing({
                      mode: "edit",
                      level: 1,
                      parentId: null,
                      id: c.id,
                      label: c.label,
                      blurb: c.blurb,
                    })
                  }
                >
                  ✏
                </button>
                <button
                  className="adm-action-btn adm-action-btn--del"
                  title="Eliminar"
                  onClick={() => del(c)}
                >
                  ✕
                </button>
              </div>
            </div>

            {byParent(c.id).map((sc) => (
              <div key={sc.id} className="adm-cat-node adm-cat-node--2">
                <div className="adm-cat-row">
                  <span className="adm-cat-label">{sc.label}</span>
                  {sc.blurb && <span className="adm-cat-blurb">{sc.blurb}</span>}
                  <div className="adm-cat-row-actions">
                    <button
                      className="adm-mini-btn"
                      onClick={() => setEditing({ mode: "new", level: 3, parentId: sc.id })}
                    >
                      + Referencia
                    </button>
                    <button
                      className="adm-action-btn"
                      title="Editar"
                      onClick={() =>
                        setEditing({
                          mode: "edit",
                          level: 2,
                          parentId: c.id,
                          id: sc.id,
                          label: sc.label,
                          blurb: sc.blurb,
                        })
                      }
                    >
                      ✏
                    </button>
                    <button
                      className="adm-action-btn adm-action-btn--del"
                      title="Eliminar"
                      onClick={() => del(sc)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {byParent(sc.id).map((rf) => (
                  <div key={rf.id} className="adm-cat-node adm-cat-node--3">
                    <div className="adm-cat-row">
                      <span className="adm-cat-label">{rf.label}</span>
                      {rf.blurb && <span className="adm-cat-blurb">{rf.blurb}</span>}
                      <div className="adm-cat-row-actions">
                        <button
                          className="adm-action-btn"
                          title="Editar"
                          onClick={() =>
                            setEditing({
                              mode: "edit",
                              level: 3,
                              parentId: sc.id,
                              id: rf.id,
                              label: rf.label,
                              blurb: rf.blurb,
                            })
                          }
                        >
                          ✏
                        </button>
                        <button
                          className="adm-action-btn adm-action-btn--del"
                          title="Eliminar"
                          onClick={() => del(rf)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {editing && <CatEditor editing={editing} onSave={save} onCancel={() => setEditing(null)} />}
    </div>
  );
}
