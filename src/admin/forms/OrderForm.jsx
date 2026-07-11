/* VETA admin · registro manual de un pedido cerrado por un asesor.
   Se usa desde Chats (teléfono precargado) y desde Despachos (en blanco).
   Guarda un borrador persistente en localStorage para sobrevivir a un cierre
   accidental del modal. */

import { useState, useEffect } from "react";
import { db } from "../../lib/db.js";
import { adminToast } from "../toast.jsx";

function orderDraftKey(fixedPhone) {
  return "veta_order_draft_" + (fixedPhone || "blank");
}

function loadOrderDraft(fixedPhone, fixedName) {
  try {
    const raw = localStorage.getItem(orderDraftKey(fixedPhone));
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    phone: fixedPhone || "",
    customer: fixedName || "",
    city: "",
    neighborhood: "",
    address: "",
    aptRef: "",
    payment: "",
    recipient: "",
    items: "",
    total: "",
    notes: "",
  };
}

export function OrderForm({ phone: fixedPhone, customerName: fixedName, onClose, onCreated }) {
  const draftKey = orderDraftKey(fixedPhone);
  const init = () => loadOrderDraft(fixedPhone, fixedName);
  const [phone, setPhone] = useState(() => init().phone);
  const [customer, setCustomer] = useState(() => init().customer);
  const [city, setCity] = useState(() => init().city);
  const [neighborhood, setNbhd] = useState(() => init().neighborhood);
  const [address, setAddress] = useState(() => init().address);
  const [aptRef, setAptRef] = useState(() => init().aptRef);
  const [payment, setPayment] = useState(() => init().payment);
  const [recipient, setRecipient] = useState(() => init().recipient);
  const [items, setItems] = useState(() => init().items);
  const [total, setTotal] = useState(() => init().total);
  const [notes, setNotes] = useState(() => init().notes);
  const [saving, setSaving] = useState(false);

  const canSave = phone.trim() && items.trim() && !saving;

  const hasContent =
    [customer, city, neighborhood, address, aptRef, payment, recipient, items, total, notes].some(
      (v) => v.trim()
    ) ||
    (!fixedPhone && phone.trim());

  // Guarda el borrador en cada cambio; así sobrevive a un clic afuera o a un cambio de chat.
  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          phone,
          customer,
          city,
          neighborhood,
          address,
          aptRef,
          payment,
          recipient,
          items,
          total,
          notes,
        })
      );
    } catch (e) {}
  }, [
    phone,
    customer,
    city,
    neighborhood,
    address,
    aptRef,
    payment,
    recipient,
    items,
    total,
    notes,
  ]);

  const discardDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch (e) {}
  };

  const cancelOrder = () => {
    if (
      hasContent &&
      !confirm("¿Descartar este pedido? Se perderá la información que ya diligenciaste.")
    )
      return;
    discardDraft();
    onClose();
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const order = await db.createOrder({
        phone: phone.trim(),
        customer_name: customer.trim(),
        city: city.trim(),
        neighborhood: neighborhood.trim(),
        address: address.trim(),
        apt_ref: aptRef.trim(),
        payment_method: payment.trim(),
        recipient_name: recipient.trim(),
        items: items.trim(),
        total: total.trim() ? Number(total) : null,
        delivery_notes: notes.trim(),
      });
      db.notifyOrderCreated(order.id);
      discardDraft();
      adminToast("Pedido registrado. Ya está en Despachos.");
      onCreated && onCreated(order);
      onClose();
    } catch (e2) {
      adminToast("No se pudo registrar: " + e2.message, true);
    }
    setSaving(false);
  };

  return (
    <div className="adm-modal-ov" onClick={onClose}>
      <div
        className="adm-crop adm-order-form"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="adm-order-form-hdr">
          <div>
            <h3 className="adm-form-card-h">Registrar pedido</h3>
            <p className="adm-hint">
              Para ventas cerradas por un asesor que Luna no haya detectado. Queda visible en
              Despachos y avisa al equipo por WhatsApp.
            </p>
          </div>
          <button
            type="button"
            className="adm-modal-x"
            onClick={onClose}
            title="Cerrar (tu borrador queda guardado)"
            aria-label="Cerrar formulario de pedido"
          >
            ×
          </button>
        </header>
        <form onSubmit={save} className="adm-order-form-body">
          <div className="adm-order-form-scroll">
            <div className="adm-form-card">
              <h3 className="adm-form-card-h">Pedido</h3>
              <div className="adm-form-grid">
                <div className="adm-form-field">
                  <label className="adm-lbl">
                    Teléfono <span className="adm-required">*</span>
                  </label>
                  <input
                    className="adm-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={!!fixedPhone}
                    placeholder="573001234567"
                    name="order-phone"
                    type="tel"
                    autoComplete="off"
                  />
                </div>
                <div className="adm-form-field">
                  <label className="adm-lbl">Cliente</label>
                  <input
                    className="adm-input"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    name="order-customer"
                    autoComplete="off"
                  />
                </div>
                <div className="adm-form-field adm-form-field--full">
                  <label className="adm-lbl">
                    Productos <span className="adm-required">*</span>
                  </label>
                  <input
                    className="adm-input"
                    value={items}
                    onChange={(e) => setItems(e.target.value)}
                    placeholder="Anillo Vena(talla 7)x1, Aretes Sol(14mm)x1"
                    name="order-items"
                    autoComplete="off"
                  />
                </div>
                <div className="adm-form-field">
                  <label className="adm-lbl">
                    Total de la venta{" "}
                    <span className="adm-field-hint-inline">— opcional, para el dashboard</span>
                  </label>
                  <input
                    className="adm-input"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    placeholder="120000"
                    name="order-total"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            <div className="adm-form-card">
              <h3 className="adm-form-card-h">Entrega</h3>
              <div className="adm-form-grid">
                <div className="adm-form-field">
                  <label className="adm-lbl">Ciudad</label>
                  <input
                    className="adm-input"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    name="order-city"
                    autoComplete="off"
                  />
                </div>
                <div className="adm-form-field">
                  <label className="adm-lbl">Barrio</label>
                  <input
                    className="adm-input"
                    value={neighborhood}
                    onChange={(e) => setNbhd(e.target.value)}
                    name="order-neighborhood"
                    autoComplete="off"
                  />
                </div>
                <div className="adm-form-field adm-form-field--full">
                  <label className="adm-lbl">Dirección</label>
                  <input
                    className="adm-input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    name="order-address"
                    autoComplete="off"
                  />
                </div>
                <div className="adm-form-field adm-form-field--full">
                  <label className="adm-lbl">Referencia / apto</label>
                  <input
                    className="adm-input"
                    value={aptRef}
                    onChange={(e) => setAptRef(e.target.value)}
                    name="order-apt-ref"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            <div className="adm-form-card">
              <h3 className="adm-form-card-h">Pago y notas</h3>
              <div className="adm-form-grid">
                <div className="adm-form-field">
                  <label className="adm-lbl">Método de pago</label>
                  <input
                    className="adm-input"
                    value={payment}
                    onChange={(e) => setPayment(e.target.value)}
                    placeholder="Transferencia, Nequi, contra entrega…"
                    name="order-payment"
                    autoComplete="off"
                  />
                </div>
                <div className="adm-form-field">
                  <label className="adm-lbl">
                    Regalo para <span className="adm-field-hint-inline">— opcional</span>
                  </label>
                  <input
                    className="adm-input"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    name="order-recipient"
                    autoComplete="off"
                  />
                </div>
                <div className="adm-form-field adm-form-field--full">
                  <label className="adm-lbl">
                    Instrucciones de entrega{" "}
                    <span className="adm-field-hint-inline">— opcional</span>
                  </label>
                  <input
                    className="adm-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Llamar a tal hora, dejar en portería, instrucciones especiales de entrega…"
                    name="order-notes"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="adm-form-actions adm-order-form-footer">
            <button
              type="button"
              className="adm-btn adm-btn--ghost"
              onClick={cancelOrder}
              disabled={saving}
            >
              Cancelar pedido
            </button>
            <button type="submit" className="adm-btn adm-btn--primary" disabled={!canSave}>
              {saving ? "Guardando…" : "Guardar pedido"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
