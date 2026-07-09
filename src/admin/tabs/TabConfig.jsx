/* VETA admin · pestaña Configuración (WhatsApp, límite del bot, contraseña,
   reset de catálogo, cierre de sesión). */

import { useState, useEffect } from "react";
import { db } from "../../lib/db.js";

function ChangePwForm() {
  const [cur, setCur] = useState("");
  const [nxt, setNxt] = useState("");
  const [rep, setRep] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (nxt !== rep) {
      setMsg({ ok: false, t: "Las nuevas contraseñas no coinciden." });
      return;
    }
    if (nxt.length < 6) {
      setMsg({ ok: false, t: "Mínimo 6 caracteres." });
      return;
    }
    setBusy(true);
    // Verificar la contraseña actual reautenticando
    const auth = await db.signIn(cur);
    if (!auth.ok) {
      setMsg({ ok: false, t: "Contraseña actual incorrecta." });
      setBusy(false);
      return;
    }
    const res = await db.changePassword(nxt);
    if (!res.ok) {
      setMsg({ ok: false, t: res.error || "No se pudo cambiar la contraseña." });
      setBusy(false);
      return;
    }
    setMsg({ ok: true, t: "Contraseña cambiada correctamente." });
    setCur("");
    setNxt("");
    setRep("");
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="adm-pw-form">
      <input
        type="password"
        className="adm-input adm-input--sm"
        placeholder="Contraseña actual"
        value={cur}
        onChange={(e) => setCur(e.target.value)}
      />
      <input
        type="password"
        className="adm-input adm-input--sm"
        placeholder="Nueva contraseña"
        value={nxt}
        onChange={(e) => setNxt(e.target.value)}
      />
      <input
        type="password"
        className="adm-input adm-input--sm"
        placeholder="Repetir nueva"
        value={rep}
        onChange={(e) => setRep(e.target.value)}
      />
      {msg && <p className={`adm-msg${msg.ok ? " adm-msg--ok" : " adm-msg--err"}`}>{msg.t}</p>}
      <button
        type="submit"
        className="adm-btn adm-btn--primary adm-btn--sm"
        disabled={busy || !cur || !nxt || !rep}
      >
        {busy ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}

export function TabConfig({ cfg, save, onLogout, resetProducts }) {
  const [phone, setPhone] = useState(cfg.wa_phone);
  const [savedPhone, setSavedPhone] = useState(false);
  const [limit, setLimit] = useState(cfg.bot_daily_limit);
  const [savedLimit, setSavedLimit] = useState(false);
  useEffect(() => {
    setPhone(cfg.wa_phone);
  }, [cfg.wa_phone]);
  useEffect(() => {
    setLimit(cfg.bot_daily_limit);
  }, [cfg.bot_daily_limit]);
  return (
    <div className="adm-page">
      <div className="adm-cfg-section">
        <h3 className="adm-cfg-h">WhatsApp del negocio</h3>
        <p className="adm-hint">Número con código de país, sin + ni espacios. Ej: 573001234567</p>
        <div className="adm-row-inline">
          <input
            className="adm-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button
            className="adm-btn adm-btn--primary adm-btn--sm"
            onClick={() => {
              save({ wa_phone: phone.replace(/\D/g, "") });
              setSavedPhone(true);
              setTimeout(() => setSavedPhone(false), 2000);
            }}
          >
            {savedPhone ? "Guardado ✓" : "Guardar"}
          </button>
        </div>
      </div>
      <hr className="adm-hr" />
      <div className="adm-cfg-section">
        <h3 className="adm-cfg-h">Límite diario del bot IA</h3>
        <p className="adm-hint">
          Máximo de mensajes que el bot responde por cliente cada día. Al alcanzarlo, avisa que un
          asesor lo atenderá. Por defecto: 10.
        </p>
        <div className="adm-row-inline">
          <input
            className="adm-input"
            type="number"
            min="1"
            max="200"
            value={limit}
            onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ maxWidth: 100 }}
          />
          <button
            className="adm-btn adm-btn--primary adm-btn--sm"
            onClick={() => {
              save({ bot_daily_limit: String(limit) });
              setSavedLimit(true);
              setTimeout(() => setSavedLimit(false), 2000);
            }}
          >
            {savedLimit ? "Guardado ✓" : "Guardar"}
          </button>
        </div>
      </div>
      <hr className="adm-hr" />
      <div className="adm-cfg-section">
        <h3 className="adm-cfg-h">Cambiar contraseña</h3>
        <p className="adm-hint">
          Contraseña por defecto: <code className="adm-code">veta2026</code>. Cámbiala tras el
          primer acceso.
        </p>
        <ChangePwForm />
      </div>
      <hr className="adm-hr" />
      <div className="adm-cfg-section">
        <h3 className="adm-cfg-h">Datos de productos</h3>
        <p className="adm-hint">
          Restablece el catálogo al estado inicial (productos de data.js). Los productos
          personalizados se perderán.
        </p>
        <button
          className="adm-btn adm-btn--ghost"
          onClick={() => {
            if (
              window.confirm(
                "¿Restablecer el catálogo a los productos originales? Los cambios en productos se perderán."
              )
            )
              resetProducts();
          }}
        >
          Restablecer catálogo original
        </button>
      </div>
      <hr className="adm-hr" />
      <div className="adm-cfg-section">
        <h3 className="adm-cfg-h">Sesión</h3>
        <p className="adm-hint">La sesión se cierra automáticamente al cerrar el navegador.</p>
        <button className="adm-btn adm-btn--ghost" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
      <hr className="adm-hr" />
      <p className="adm-note">
        <strong>Nota:</strong> Stock, visibilidad, productos y configuración se guardan en Supabase
        y están disponibles desde cualquier dispositivo en tiempo real.
      </p>
    </div>
  );
}
