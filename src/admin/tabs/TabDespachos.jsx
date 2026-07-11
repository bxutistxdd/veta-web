/* VETA admin · pestaña Despachos (gestión de pedidos: estado, notas, ocultar,
   cancelar, eliminar) + tarjeta de pedido. */

import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../../lib/db.js";
import { adminToast } from "../toast.jsx";
import { OrderForm } from "../forms/OrderForm.jsx";

const DESP_LABELS = {
  pending: "Pendiente",
  dispatched: "Despachado",
  delivered: "Entregado",
  problem: "⚠ Problema",
  cancelled: "Cancelado",
};
const DESP_STATUSES = ["pending", "dispatched", "delivered", "problem", "cancelled"];

// Compatibilidad con pedidos viejos que guardaban pago/dirección dentro de `notes`.
function parseOrderNotes(notes) {
  if (!notes) return { payment: "", address: "" };
  const dirIdx = notes.search(/dir:/i);
  const payMatch = notes.match(/pago:\s*([^.]+)/i);
  return {
    payment: payMatch ? payMatch[1].trim() : "",
    address: dirIdx >= 0 ? notes.slice(dirIdx + 4).trim() : "",
  };
}

const EyeOpen = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeClosed = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M10.73 10.73a3 3 0 0 0 4.24 4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

function OrderCard({
  order,
  onStatusChange,
  onNotesSave,
  onDeliveryNotesSave,
  onDelete,
  onToggleHidden,
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState(order.admin_notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [deliveryVal, setDeliveryVal] = useState(order.delivery_notes || "");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    setNotesVal(order.admin_notes || "");
  }, [order.admin_notes]);
  useEffect(() => {
    setDeliveryVal(order.delivery_notes || "");
  }, [order.delivery_notes]);

  const { payment: legacyPayment, address: legacyAddress } = parseOrderNotes(order.notes);
  const address = order.address || legacyAddress || "";
  const nbhd = order.neighborhood || "";
  const aptRef = order.apt_ref || "";
  const payment = order.payment_method || legacyPayment || "";
  const recipient = order.recipient_name || "";
  const NA = "No proporcionó";

  const date = new Date(order.created_at).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = new Date(order.created_at).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const handleStatus = async (e) => {
    const s = e.target.value;
    if (s === order.status || statusBusy) return;
    setStatusBusy(true);
    await onStatusChange(order.id, s);
    setStatusBusy(false);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await onNotesSave(order.id, notesVal);
    setSavingNotes(false);
    setEditingNotes(false);
  };

  const handleSaveDelivery = async () => {
    setSavingDelivery(true);
    await onDeliveryNotesSave(order.id, deliveryVal);
    setSavingDelivery(false);
    setEditingDelivery(false);
  };

  const handleCancel = async () => {
    setActionBusy(true);
    await onStatusChange(order.id, "cancelled");
    setActionBusy(false);
    setConfirmCancel(false);
  };

  const handleDelete = async () => {
    setActionBusy(true);
    await onDelete(order.id);
    setActionBusy(false);
  };

  return (
    <div
      className={`adm-desp-card adm-desp-card--${order.status}${order.hidden ? " adm-desp-card--hidden" : ""}`}
    >
      {/* Top: pill + eye + meta */}
      <div className="adm-desp-card-top">
        <span className={`adm-desp-pill adm-desp-pill--${order.status}`}>
          {DESP_LABELS[order.status] || order.status}
        </span>
        <div className="adm-desp-card-top-right">
          <button
            className={`adm-desp-eye${order.hidden ? " adm-desp-eye--off" : ""}`}
            onClick={() => onToggleHidden(order.id, !order.hidden)}
            title={order.hidden ? "Mostrar pedido" : "Ocultar pedido"}
            aria-label={order.hidden ? "Mostrar pedido" : "Ocultar pedido"}
          >
            {order.hidden ? <EyeClosed /> : <EyeOpen />}
          </button>
          <div className="adm-desp-meta">
            {order.order_number && (
              <span className="adm-desp-order-num">#{order.order_number}</span>
            )}
            <span className="adm-desp-date">{date}</span>
            <span className="adm-desp-date">{time}</span>
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div className="adm-desp-customer">
        <div className="adm-desp-name">{order.customer_name || "Cliente"}</div>
        <a
          className="adm-desp-phone"
          href={"https://wa.me/" + order.phone}
          target="_blank"
          rel="noopener"
        >
          +{order.phone}
        </a>
      </div>

      {/* Piezas */}
      <div className="adm-desp-items-block">
        <span className="adm-desp-items-lbl">Piezas</span>
        {order.items}
      </div>

      {/* Campos fijos — siempre visibles */}
      <div className="adm-desp-fields">
        <div className="adm-desp-field">
          <span className="adm-desp-lbl">Ciudad</span>
          {order.city ? (
            <span>
              {order.city}
              {nbhd ? `, ${nbhd}` : ""}
            </span>
          ) : (
            <em className="adm-desp-na">{NA}</em>
          )}
        </div>
        <div className="adm-desp-field">
          <span className="adm-desp-lbl">Dirección</span>
          {address ? <span>{address}</span> : <em className="adm-desp-na">{NA}</em>}
        </div>
        <div className="adm-desp-field">
          <span className="adm-desp-lbl">Ref/Entrega</span>
          {aptRef ? <span>{aptRef}</span> : <em className="adm-desp-na">{NA}</em>}
        </div>
        <div className="adm-desp-field">
          <span className="adm-desp-lbl">Pago</span>
          {payment ? <span>{payment}</span> : <em className="adm-desp-na">{NA}</em>}
        </div>
        {recipient && (
          <div className="adm-desp-field adm-desp-field--gift">
            <span className="adm-desp-lbl">Regalo para</span>
            <span>{recipient}</span>
          </div>
        )}
      </div>

      {/* Información adicional de entrega (editable) */}
      <div className="adm-desp-notes-wrap">
        {editingDelivery ? (
          <>
            <textarea
              className="adm-input adm-desp-notes-ta"
              value={deliveryVal}
              onChange={(e) => setDeliveryVal(e.target.value)}
              placeholder="Llamar a tal hora, dejar en portería, instrucciones especiales de entrega…"
              rows={2}
            />
            <div className="adm-desp-notes-actions">
              <button
                className="adm-btn adm-btn--sm"
                onClick={() => {
                  setDeliveryVal(order.delivery_notes || "");
                  setEditingDelivery(false);
                }}
              >
                Cancelar
              </button>
              <button
                className="adm-btn adm-btn--primary adm-btn--sm"
                disabled={savingDelivery}
                onClick={handleSaveDelivery}
              >
                {savingDelivery ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </>
        ) : (
          <button
            className="adm-desp-notes-btn adm-desp-notes-btn--info"
            onClick={() => setEditingDelivery(true)}
          >
            <span className="adm-desp-notes-icon">{order.delivery_notes ? "📦" : "＋"}</span>
            <span>{order.delivery_notes || "Información adicional de entrega"}</span>
          </button>
        )}
      </div>

      {/* Nota de despacho (admin) */}
      <div className="adm-desp-notes-wrap">
        {editingNotes ? (
          <>
            <textarea
              className="adm-input adm-desp-notes-ta"
              value={notesVal}
              onChange={(e) => setNotesVal(e.target.value)}
              placeholder="Guía de envío, transportadora, observaciones del admin…"
              rows={2}
            />
            <div className="adm-desp-notes-actions">
              <button
                className="adm-btn adm-btn--sm"
                onClick={() => {
                  setNotesVal(order.admin_notes || "");
                  setEditingNotes(false);
                }}
              >
                Cancelar
              </button>
              <button
                className="adm-btn adm-btn--primary adm-btn--sm"
                disabled={savingNotes}
                onClick={handleSaveNotes}
              >
                {savingNotes ? "Guardando…" : "Guardar nota"}
              </button>
            </div>
          </>
        ) : (
          <button className="adm-desp-notes-btn" onClick={() => setEditingNotes(true)}>
            <span className="adm-desp-notes-icon">{order.admin_notes ? "📋" : "＋"}</span>
            <span>{order.admin_notes || "Nota de despacho (admin)"}</span>
          </button>
        )}
      </div>

      {/* Columna de acciones: estado → cancelar → eliminar */}
      <div className="adm-desp-actions-col">
        <select
          className="adm-desp-status-select"
          value={order.status}
          disabled={statusBusy}
          onChange={handleStatus}
        >
          {DESP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DESP_LABELS[s]}
            </option>
          ))}
        </select>

        {!confirmCancel ? (
          <button
            className="adm-desp-action-btn adm-desp-action-btn--cancel"
            disabled={actionBusy || order.status === "cancelled"}
            onClick={() => setConfirmCancel(true)}
          >
            Cancelar pedido
          </button>
        ) : (
          <div className="adm-desp-confirm">
            <span className="adm-desp-confirm-q">¿Cancelar este pedido?</span>
            <div className="adm-desp-confirm-btns">
              <button className="adm-btn adm-btn--sm" onClick={() => setConfirmCancel(false)}>
                No
              </button>
              <button
                className="adm-btn adm-btn--danger adm-btn--sm"
                disabled={actionBusy}
                onClick={handleCancel}
              >
                {actionBusy ? "…" : "Sí, cancelar"}
              </button>
            </div>
          </div>
        )}

        {!confirmDelete ? (
          <button
            className="adm-desp-action-btn adm-desp-action-btn--delete"
            disabled={actionBusy}
            onClick={() => setConfirmDelete(true)}
          >
            Eliminar pedido
          </button>
        ) : (
          <div className="adm-desp-confirm">
            <span className="adm-desp-confirm-q">¿Eliminar definitivamente?</span>
            <div className="adm-desp-confirm-btns">
              <button className="adm-btn adm-btn--sm" onClick={() => setConfirmDelete(false)}>
                No
              </button>
              <button
                className="adm-btn adm-btn--danger adm-btn--sm"
                disabled={actionBusy}
                onClick={handleDelete}
              >
                {actionBusy ? "…" : "Eliminar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TabDespachos() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [q, setQ] = useState("");
  const [showOrderForm, setShowOrderForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.getOrders();
      setOrders(data);
    } catch (e) {
      adminToast("No se pudieron cargar los despachos: " + e.message, true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await db.updateOrderStatus(id, newStatus);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o)));
      adminToast("Estado actualizado.");
    } catch (e) {
      adminToast("No se pudo actualizar: " + e.message, true);
    }
  };

  const handleNotesSave = async (id, notes) => {
    try {
      await db.updateOrderNotes(id, notes);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, admin_notes: notes } : o)));
      adminToast("Nota guardada.");
    } catch (e) {
      adminToast("No se pudo guardar: " + e.message, true);
    }
  };

  const handleDeliveryNotesSave = async (id, delivery_notes) => {
    try {
      await db.updateOrderDeliveryNotes(id, delivery_notes);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, delivery_notes } : o)));
      adminToast("Nota guardada.");
    } catch (e) {
      adminToast("No se pudo guardar: " + e.message, true);
    }
  };

  const handleDelete = async (id) => {
    try {
      await db.deleteOrder(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      adminToast("Pedido eliminado.");
    } catch (e) {
      adminToast("No se pudo eliminar: " + e.message, true);
    }
  };

  const handleToggleHidden = async (id, hidden) => {
    try {
      await db.toggleOrderHidden(id, hidden);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, hidden } : o)));
      adminToast(hidden ? "Pedido ocultado." : "Pedido visible.");
    } catch (e) {
      adminToast("No se pudo cambiar: " + e.message, true);
    }
  };

  const counts = useMemo(() => {
    const c = {
      active: 0,
      pending: 0,
      dispatched: 0,
      delivered: 0,
      problem: 0,
      hidden: 0,
      todos: 0,
    };
    orders.forEach((o) => {
      c.todos++;
      if (o.hidden) {
        c.hidden++;
        return;
      }
      if (o.status === "pending") {
        c.active++;
        c.pending++;
      }
      if (o.status === "dispatched") {
        c.active++;
        c.dispatched++;
      }
      if (o.status === "delivered") c.delivered++;
      if (o.status === "problem") c.problem++;
    });
    return c;
  }, [orders]);

  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        if (filter === "todos") {
          /* mostrar todo */
        } else if (filter === "hidden") {
          if (!o.hidden) return false;
        } else {
          if (o.hidden) return false;
          if (filter === "active") {
            if (o.status !== "pending" && o.status !== "dispatched") return false;
          } else {
            if (o.status !== filter) return false;
          }
        }
        if (q) {
          const hay = (o.customer_name || "") + " " + o.phone + " " + (o.city || "");
          if (!hay.toLowerCase().includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [orders, filter, q]
  );

  const FILTER_OPTS = [
    ["active", "Activos"],
    ["pending", "Pendientes"],
    ["dispatched", "Despachados"],
    ["delivered", "Entregados"],
    ["problem", "⚠ Peligro"],
    ["hidden", "Ocultos"],
    ["todos", "Todos los pedidos"],
  ];

  return (
    <div className="adm-desp-wrap">
      <div className="adm-desp-toolbar">
        <div className="adm-desp-filters">
          {FILTER_OPTS.map(([id, label]) => (
            <button
              key={id}
              className={`adm-desp-chip${filter === id ? " adm-desp-chip--on" : ""}${id === "problem" ? " adm-desp-chip--warn" : ""}${id === "hidden" ? " adm-desp-chip--muted" : ""}`}
              onClick={() => setFilter(id)}
            >
              {label}
              {counts[id] > 0 && <span className="adm-desp-chip-count">{counts[id]}</span>}
            </button>
          ))}
        </div>
        <div className="adm-desp-toolbar-right">
          <input
            className="adm-input adm-desp-search"
            placeholder="Buscar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="adm-btn adm-btn--sm adm-btn--ghost"
            onClick={() => setShowOrderForm(true)}
          >
            + Nuevo pedido
          </button>
          <button
            className="adm-desp-reload"
            onClick={load}
            disabled={loading}
            title="Actualizar"
            aria-label="Actualizar lista de pedidos"
          >
            ↺
          </button>
        </div>
      </div>

      {showOrderForm && (
        <OrderForm
          onClose={() => setShowOrderForm(false)}
          onCreated={(o) => setOrders((prev) => [o, ...prev])}
        />
      )}

      {loading ? (
        <p className="adm-desp-empty adm-desp-empty--loading">Cargando pedidos…</p>
      ) : filtered.length === 0 ? (
        <p className="adm-desp-empty">
          {filter === "active" ? "No hay pedidos activos." : "No hay pedidos con este estado."}
        </p>
      ) : (
        <div className="adm-desp-list">
          {filtered.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onStatusChange={handleStatusChange}
              onNotesSave={handleNotesSave}
              onDeliveryNotesSave={handleDeliveryNotesSave}
              onDelete={handleDelete}
              onToggleHidden={handleToggleHidden}
            />
          ))}
        </div>
      )}
    </div>
  );
}
