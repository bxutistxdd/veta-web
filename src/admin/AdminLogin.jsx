/* VETA admin · pantalla de login (solo contraseña; el correo del admin es fijo). */

import { useState, useRef, useEffect } from "react";

export function AdminLogin({ onLogin, loading, err }) {
  const [pw, setPw] = useState("");
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="adm-login-wrap">
      <div className="adm-login-card">
        <div className="adm-login-logo">VETA</div>
        <p className="adm-login-sub">Panel de administración</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            pw && onLogin(pw);
          }}
        >
          <label className="adm-lbl" htmlFor="adm-pw">
            Contraseña
          </label>
          <input
            id="adm-pw"
            ref={ref}
            type="password"
            className="adm-input"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          {err && <p className="adm-msg adm-msg--err">{err}</p>}
          <button type="submit" className="adm-btn adm-btn--primary" disabled={loading || !pw}>
            {loading ? "Verificando…" : "Entrar"}
          </button>
        </form>
        <a href="#home" className="adm-back-link">
          ← Volver al sitio
        </a>
      </div>
    </div>
  );
}
