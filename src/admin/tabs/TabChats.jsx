/* VETA admin · pestaña Chats (buzón de WhatsApp estilo app de mensajería).
   Lista de conversaciones + hilo activo en tiempo real, envío como asesor,
   "Tomar control" (pausa la IA) y registro de pedido desde el chat. */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { db } from "../../lib/db.js";
import { adminToast } from "../toast.jsx";
import { ADMIN_TABS } from "../constants.js";
import { OrderForm } from "../forms/OrderForm.jsx";

const CHAT_SEEN_KEY = "veta_chat_seen";
function loadSeen() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_SEEN_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveSeen(m) {
  try {
    localStorage.setItem(CHAT_SEEN_KEY, JSON.stringify(m));
  } catch {}
}

function chatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
function chatDayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return "Hoy";
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay(d, yest)) return "Ayer";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}
function chatListTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return chatTime(iso);
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });
}
function chatInitial(name, phone) {
  const s = (name || "").trim();
  if (s) return s[0].toUpperCase();
  return (phone || "?").slice(-2, -1) || "#";
}
function fmtPhone(phone) {
  // 573001234567 → +57 300 123 4567 (aprox., solo presentación)
  if (!phone) return "";
  const p = phone.replace(/\D/g, "");
  if (p.length === 12 && p.startsWith("57"))
    return `+57 ${p.slice(2, 5)} ${p.slice(5, 8)} ${p.slice(8)}`;
  return "+" + p;
}
const ROLE_OUT = { assistant: true, agent: true }; // salientes (derecha)

// En móvil (táctil) Enter = salto de línea; se envía solo con el botón.
const CHAT_IS_TOUCH =
  typeof window !== "undefined" &&
  ("ontouchstart" in window ||
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches));

// Inserta un mensaje manteniendo el orden por created_at, para que un mensaje
// que llega por realtime no quede fuera de lugar respecto a su par.
function insertSortedMsg(list, row) {
  if (list.some((m) => m.id === row.id)) return list;
  const next = [...list, row];
  next.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return next;
}

// Texto resumido de un mensaje (cita / preview de la lista).
function msgPreview(m) {
  if (!m) return "";
  if (m.msg_type === "image")
    return "📷 " + (m.content && m.content !== "[imagen]" ? m.content : "Imagen");
  return m.content || "";
}

function ChatBubbleRow({ msg, prev, byMid }) {
  const out = ROLE_OUT[msg.role];
  const tag = msg.role === "assistant" ? "IA" : msg.role === "agent" ? "Tú" : null;
  const showDay = !prev || chatDayLabel(prev.created_at) !== chatDayLabel(msg.created_at);
  const quoted = msg.reply_to ? byMid && byMid[msg.reply_to] : null;
  const isImg = msg.msg_type === "image" && msg.media_url;
  const caption = isImg && msg.content && msg.content !== "[imagen]" ? msg.content : "";
  return (
    <>
      {showDay && (
        <div className="adm-chat-daysep">
          <span>{chatDayLabel(msg.created_at)}</span>
        </div>
      )}
      <div
        className={`adm-chat-msg ${out ? "adm-chat-msg--out" : "adm-chat-msg--in"} adm-chat-msg--${msg.role}`}
      >
        <div className="adm-chat-bubble">
          {tag && <span className={`adm-chat-tag adm-chat-tag--${msg.role}`}>{tag}</span>}
          {msg.reply_to && (
            <span className={`adm-chat-quote${quoted ? ` adm-chat-quote--${quoted.role}` : ""}`}>
              <span className="adm-chat-quote-text">
                {quoted ? msgPreview(quoted) : "Mensaje citado"}
              </span>
            </span>
          )}
          {isImg && (
            <a
              className="adm-chat-img-wrap"
              href={msg.media_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img className="adm-chat-img" src={msg.media_url} alt="Imagen" loading="lazy" />
            </a>
          )}
          {(!isImg || caption) && (
            <span className="adm-chat-text">{isImg ? caption : msg.content}</span>
          )}
          <span className="adm-chat-meta">{chatTime(msg.created_at)}</span>
        </div>
      </div>
    </>
  );
}

export function TabChats({ goTab }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null); // phone
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [filter, setFilter] = useState("todos"); // todos | atencion | pausa
  const [q, setQ] = useState("");
  const [seen, setSeen] = useState(loadSeen);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [orders, setOrders] = useState([]);
  const [pendingImg, setPendingImg] = useState(null); // { file, url } imagen a enviar
  const [showOrderForm, setShowOrderForm] = useState(false);

  const activeRef = useRef(active);
  activeRef.current = active;
  const endRef = useRef(null);
  const fileRef = useRef(null);

  // Mapa wa_mid -> mensaje, para resolver las citas (reply/quote).
  const byMid = useMemo(() => {
    const m = {};
    messages.forEach((x) => {
      if (x.wa_mid) m[x.wa_mid] = x;
    });
    return m;
  }, [messages]);

  const reloadList = useCallback(async () => {
    await db.loadThreads();
    const l = await db.getConversationList();
    setList(l);
    setLoading(false);
  }, []);

  const openThread = useCallback(async (phone) => {
    setActive(phone);
    setMsgLoading(true);
    setOrders([]);
    const msgs = await db.getMessages(phone);
    setMessages(msgs);
    setMsgLoading(false);
    setSeen((prev) => {
      const n = { ...prev, [phone]: new Date().toISOString() };
      saveSeen(n);
      return n;
    });
    const th = db.getThreads()[phone];
    if (th?.needs_human) {
      try {
        await db.clearNeedsHuman(phone);
      } catch {}
    }
    try {
      const { data } = await db.sb
        .from("wa_orders")
        .select("*")
        .eq("phone", phone)
        .order("created_at", { ascending: false });
      setOrders(data || []);
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    reloadList();
    const unsub = db.subscribeChats((ev) => {
      if (ev.type === "message" && ev.row && ev.row.phone === activeRef.current) {
        setMessages((prev) => insertSortedMsg(prev, ev.row));
        setSeen((prev) => {
          const n = { ...prev, [ev.row.phone]: new Date().toISOString() };
          saveSeen(n);
          return n;
        });
      }
      reloadList();
    });
    return unsub;
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const unreadOf = (c) => {
    const s = seen[c.phone];
    return (
      c.last &&
      (!s || new Date(c.last.created_at) > new Date(s)) &&
      c.last.phone !== undefined &&
      c.last.role === "user"
    );
  };

  const filtered = list.filter((c) => {
    if (filter === "atencion" && !(c.thread && c.thread.needs_human)) return false;
    if (filter === "pausa" && !(c.thread && c.thread.bot_paused)) return false;
    if (q) {
      const hay = (c.thread?.customer_name || "") + " " + c.phone;
      if (!hay.toLowerCase().includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const activeThread =
    list.find((c) => c.phone === active)?.thread || (active && db.getThreads()[active]) || null;
  const activeName = activeThread?.customer_name || "";
  const paused = !!activeThread?.bot_paused;
  const atencionCount = list.filter((c) => c.thread && c.thread.needs_human).length;

  const toggleControl = async () => {
    if (!active) return;
    try {
      await db.setBotPaused(active, !paused);
      adminToast(
        !paused
          ? "Tomaste el control. La IA quedó en pausa para este chat."
          : "La IA retoma este chat."
      );
      reloadList();
    } catch (e) {
      adminToast("No se pudo cambiar: " + e.message, true);
    }
  };

  const clearPendingImg = () => {
    setPendingImg((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const onPickImage = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type || "")) {
      adminToast("Selecciona un archivo de imagen.", true);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      adminToast("La imagen supera 5 MB.", true);
      return;
    }
    setPendingImg((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { file, url: URL.createObjectURL(file) };
    });
  };

  const send = async () => {
    const text = draft.trim();
    if ((!text && !pendingImg) || !active || sending) return;
    setSending(true);
    const onRetry = () => adminToast("El servidor está tardando en responder, reintentando…");
    try {
      if (pendingImg) {
        const mediaUrl = await db.uploadChatImage(active, pendingImg.file);
        await db.sendAgentMessage(active, { text, type: "image", mediaUrl }, { onRetry });
      } else {
        await db.sendAgentMessage(active, text, { onRetry });
      }
      setDraft("");
      clearPendingImg();
      const msgs = await db.getMessages(active);
      setMessages(msgs);
      reloadList();
    } catch (e) {
      adminToast(e.message || "No se pudo enviar.", true);
    }
    setSending(false);
  };

  return (
    <div className={`adm-chat ${active ? "adm-chat--thread-open" : ""}`}>
      {/* ── Lista de conversaciones ── */}
      <aside className="adm-chat-list">
        <div className="adm-chat-list-top">
          {goTab && (
            <div className="adm-chat-nav-bar">
              <select
                className="adm-chat-nav-select"
                value="chats"
                onChange={(e) => goTab(e.target.value)}
              >
                {ADMIN_TABS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="adm-chat-nav-chevron" aria-hidden="true">
                ▾
              </span>
            </div>
          )}
          <input
            className="adm-input adm-input--sm"
            placeholder="Buscar por nombre o número…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="adm-chat-filters">
            <button
              className={`adm-pill${filter === "todos" ? " adm-pill--on" : ""}`}
              onClick={() => setFilter("todos")}
            >
              Todos
            </button>
            <button
              className={`adm-pill${filter === "atencion" ? " adm-pill--on" : ""}`}
              onClick={() => setFilter("atencion")}
            >
              Requieren atención{atencionCount > 0 ? ` · ${atencionCount}` : ""}
            </button>
            <button
              className={`adm-pill${filter === "pausa" ? " adm-pill--on" : ""}`}
              onClick={() => setFilter("pausa")}
            >
              En pausa
            </button>
          </div>
        </div>
        <div className="adm-chat-list-scroll">
          {loading && <p className="adm-empty adm-empty--loading">Cargando conversaciones…</p>}
          {!loading && filtered.length === 0 && (
            <p className="adm-empty">
              {q || filter !== "todos"
                ? "Sin conversaciones que coincidan."
                : "Aún no hay conversaciones."}
            </p>
          )}
          {filtered.map((c) => {
            const needs = c.thread && c.thread.needs_human;
            const isPaused = c.thread && c.thread.bot_paused;
            const unread = unreadOf(c);
            return (
              <button
                key={c.phone}
                className={`adm-chat-item${active === c.phone ? " adm-chat-item--on" : ""}${needs ? " adm-chat-item--alert" : ""}`}
                onClick={() => openThread(c.phone)}
              >
                <span className="adm-chat-avatar">
                  {chatInitial(c.thread?.customer_name, c.phone)}
                </span>
                <span className="adm-chat-item-body">
                  <span className="adm-chat-item-top">
                    <span className="adm-chat-item-name">
                      {c.thread?.customer_name || fmtPhone(c.phone)}
                    </span>
                    <span className="adm-chat-item-time">{chatListTime(c.last.created_at)}</span>
                  </span>
                  <span className="adm-chat-item-bottom">
                    <span className="adm-chat-item-prev">
                      {c.last.role === "user" ? "" : c.last.role === "agent" ? "Tú: " : "IA: "}
                      {msgPreview(c.last)}
                    </span>
                    <span className="adm-chat-item-badges">
                      {needs && (
                        <span className="adm-chat-dot adm-chat-dot--alert" title="Requiere asesor">
                          !
                        </span>
                      )}
                      {isPaused && (
                        <span className="adm-chat-pill-mini" title="IA en pausa">
                          ⏸
                        </span>
                      )}
                      {unread && !needs && <span className="adm-chat-dot" />}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Hilo activo ── */}
      <section className="adm-chat-thread">
        {!active && (
          <div className="adm-chat-empty">
            <div className="adm-chat-empty-logo">VETA</div>
            <p>Selecciona una conversación para ver y responder los mensajes.</p>
            <p className="adm-hint">Las conversaciones llegan en tiempo real desde WhatsApp.</p>
          </div>
        )}
        {active && (
          <>
            <header className="adm-chat-thread-hdr">
              <button className="adm-chat-back" onClick={() => setActive(null)} title="Volver">
                ←
              </button>
              <span className="adm-chat-avatar">{chatInitial(activeName, active)}</span>
              <div className="adm-chat-thread-id">
                <span className="adm-chat-thread-name">{activeName || fmtPhone(active)}</span>
                <span className="adm-chat-thread-sub">
                  {fmtPhone(active)}
                  {paused ? " · IA en pausa" : " · IA activa"}
                  {orders.length > 0
                    ? ` · ${orders.length} pedido${orders.length > 1 ? "s" : ""}`
                    : ""}
                </span>
              </div>
              <button
                className="adm-btn adm-btn--sm adm-btn--ghost"
                onClick={() => setShowOrderForm(true)}
              >
                Registrar pedido
              </button>
              <button
                className={`adm-btn adm-btn--sm ${paused ? "adm-btn--primary" : "adm-btn--ghost"}`}
                onClick={toggleControl}
              >
                {paused ? "Devolver a la IA" : "Tomar control"}
              </button>
            </header>

            {paused && (
              <div className="adm-chat-banner">
                Estás atendiendo este chat — la IA no responderá hasta que lo devuelvas.
              </div>
            )}

            {showOrderForm && (
              <OrderForm
                phone={active}
                customerName={activeName}
                onClose={() => setShowOrderForm(false)}
                onCreated={(o) => setOrders((prev) => [o, ...prev])}
              />
            )}

            <div className="adm-chat-scroll">
              {msgLoading && <p className="adm-empty adm-empty--loading">Cargando mensajes…</p>}
              {!msgLoading && messages.length === 0 && (
                <p className="adm-empty">Sin mensajes todavía.</p>
              )}
              {messages.map((m, i) => (
                <ChatBubbleRow key={m.id || i} msg={m} prev={messages[i - 1]} byMid={byMid} />
              ))}
              <div ref={endRef} />
            </div>

            <div className="adm-chat-composer">
              {pendingImg && (
                <div className="adm-chat-attach">
                  <img src={pendingImg.url} alt="Adjunto" className="adm-chat-attach-thumb" />
                  <button
                    className="adm-chat-attach-x"
                    onClick={clearPendingImg}
                    title="Quitar imagen"
                    aria-label="Quitar imagen adjunta"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="adm-chat-composer-row">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
                <button
                  className="adm-chat-attach-btn"
                  onClick={() => fileRef.current && fileRef.current.click()}
                  disabled={sending}
                  title="Adjuntar imagen"
                  aria-label="Adjuntar imagen"
                >
                  📎
                </button>
                <textarea
                  className="adm-chat-input"
                  rows={1}
                  placeholder="Escribe un mensaje…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !CHAT_IS_TOUCH) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button
                  className="adm-chat-send"
                  onClick={send}
                  disabled={sending || (!draft.trim() && !pendingImg)}
                  title="Enviar"
                  aria-label={sending ? "Enviando mensaje…" : "Enviar mensaje"}
                >
                  {sending ? <span className="adm-spinner" aria-hidden="true" /> : "➤"}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
