/* VETA admin · formulario de código de descuento (crear/editar). */

import { useState, useCallback } from "react";
import { VETA_DATA } from "../../lib/data.js";

const DISC_EMPTY = {
  code: "",
  description: "",
  type: "percent",
  value: "",
  min_subtotal: "",
  max_uses: "",
  active: true,
  show_on_site: false,
  expires_at: "",
};

export function DiscountForm({ initial, onSave, onCancel }) {
  const isNew = !initial?.id;
  const [form, setForm] = useState(() =>
    initial
      ? {
          ...initial,
          value: String(initial.value || ""),
          min_subtotal: String(initial.min_subtotal || ""),
          max_uses:
            initial.max_uses !== null && initial.max_uses !== undefined
              ? String(initial.max_uses)
              : "",
          expires_at: initial.expires_at ? initial.expires_at.slice(0, 10) : "",
        }
      : { ...DISC_EMPTY }
  );
  const [errors, setErrors] = useState({});
  const set = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);

  const validate = () => {
    const e = {};
    if (!form.code.trim()) e.code = "El código es obligatorio.";
    if (!form.value || Number(form.value) <= 0) e.value = "El valor debe ser mayor a 0.";
    if (form.type === "percent" && Number(form.value) > 100)
      e.value = "El porcentaje no puede superar 100.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const ok = await onSave({
      id: form.id,
      code: form.code.toUpperCase().trim(),
      description: form.description.trim(),
      type: form.type,
      value: Number(form.value),
      min_subtotal: Number(form.min_subtotal) || 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      active: form.active,
      show_on_site: form.show_on_site,
      expires_at: form.expires_at || null,
    });
    if (ok) onCancel();
  };

  return (
    <div className="adm-disc-form-wrap">
      <div className="adm-form-topbar">
        <button type="button" className="adm-back-btn" onClick={onCancel}>
          ← Volver
        </button>
        <h2 className="adm-form-title">
          {isNew ? "Nuevo código de descuento" : `Editar · ${initial.code}`}
        </h2>
      </div>
      <form onSubmit={submit} className="adm-product-form">
        <div className="adm-form-card">
          <h3 className="adm-form-card-h">Código y descripción</h3>
          <div className="adm-form-grid">
            <div className="adm-form-field adm-form-field--full">
              <label className="adm-lbl">
                Código <span className="adm-required">*</span>
              </label>
              <input
                className={`adm-input adm-input--mono${errors.code ? " adm-input--err" : ""}`}
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="VETAINAUGURACIÓN"
                style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
              />
              {errors.code && <span className="adm-field-err">{errors.code}</span>}
              <span className="adm-field-hint">
                El cliente ingresará este texto exacto en el carrito.
              </span>
            </div>
            <div className="adm-form-field adm-form-field--full">
              <label className="adm-lbl">Descripción</label>
              <input
                className="adm-input"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Ej: 25% de descuento por inauguración"
              />
            </div>
          </div>
        </div>

        <div className="adm-form-card">
          <h3 className="adm-form-card-h">Tipo y valor</h3>
          <div className="adm-form-grid">
            <div className="adm-form-field">
              <label className="adm-lbl">Tipo de descuento</label>
              <select
                className="adm-input"
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
              >
                <option value="percent">Porcentaje (%)</option>
                <option value="fixed">Valor fijo (COP)</option>
              </select>
            </div>
            <div className="adm-form-field">
              <label className="adm-lbl">
                Valor <span className="adm-required">*</span>
              </label>
              <div className="adm-price-row">
                <input
                  className={`adm-input${errors.value ? " adm-input--err" : ""}`}
                  type="number"
                  min="0"
                  step={form.type === "percent" ? "1" : "1000"}
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  placeholder={form.type === "percent" ? "25" : "50000"}
                />
                <span className="adm-price-cur">{form.type === "percent" ? "%" : "COP"}</span>
              </div>
              {errors.value && <span className="adm-field-err">{errors.value}</span>}
              {Number(form.value) > 0 && (
                <span className="adm-field-hint">
                  {form.type === "percent"
                    ? `${form.value}% de descuento`
                    : `${VETA_DATA.fmtPrice(Number(form.value))} de descuento`}
                </span>
              )}
            </div>
            <div className="adm-form-field">
              <label className="adm-lbl">Subtotal mínimo (COP)</label>
              <input
                className="adm-input"
                type="number"
                min="0"
                step="1000"
                value={form.min_subtotal}
                onChange={(e) => set("min_subtotal", e.target.value)}
                placeholder="0 = sin mínimo"
              />
            </div>
            <div className="adm-form-field">
              <label className="adm-lbl">Usos máximos</label>
              <input
                className="adm-input"
                type="number"
                min="1"
                step="1"
                value={form.max_uses}
                onChange={(e) => set("max_uses", e.target.value)}
                placeholder="Vacío = sin límite"
              />
            </div>
            <div className="adm-form-field">
              <label className="adm-lbl">Vence el</label>
              <input
                className="adm-input"
                type="date"
                value={form.expires_at}
                onChange={(e) => set("expires_at", e.target.value)}
              />
              <span className="adm-field-hint">Vacío = no vence</span>
            </div>
          </div>
        </div>

        <div className="adm-form-card">
          <h3 className="adm-form-card-h">Visibilidad</h3>
          <div className="adm-disc-toggles">
            <label className="adm-disc-toggle">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set("active", e.target.checked)}
              />
              <span className="adm-disc-toggle-label">Código activo</span>
              <span className="adm-field-hint">Los clientes pueden usarlo</span>
            </label>
            <label className="adm-disc-toggle">
              <input
                type="checkbox"
                checked={form.show_on_site}
                onChange={(e) => set("show_on_site", e.target.checked)}
              />
              <span className="adm-disc-toggle-label">Mostrar en el sitio</span>
              <span className="adm-field-hint">
                Aparece como banner en la tienda (para promociones públicas)
              </span>
            </label>
          </div>
        </div>

        <div className="adm-form-actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="adm-btn adm-btn--primary">
            {isNew ? "Crear código" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
