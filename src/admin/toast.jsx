/* VETA admin · avisos (toast) del panel.
   Bus mínimo pub/sub: adminToast(text) desde cualquier módulo, <Toaster/>
   montado una vez en la raíz los pinta abajo a la derecha. */

import { useState, useEffect } from "react";

const _toastSubs = [];

export function adminToast(text, isErr = false) {
  _toastSubs.forEach((fn) => fn({ text, isErr, id: Date.now() + Math.random() }));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (t) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3500);
    };
    _toastSubs.push(fn);
    return () => {
      const i = _toastSubs.indexOf(fn);
      if (i >= 0) _toastSubs.splice(i, 1);
    };
  }, []);
  if (!items.length) return null;
  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            maxWidth: 320,
            fontSize: 14,
            color: "#fff",
            background: t.isErr ? "#b3261e" : "#1f7a4d",
            boxShadow: "0 6px 20px rgba(0,0,0,.25)",
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
