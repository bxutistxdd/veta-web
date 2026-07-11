/* VETA admin · avisos (toast) del panel.
   Bus mínimo pub/sub: adminToast(text) desde cualquier módulo, <Toaster/>
   montado una vez en la raíz los pinta abajo a la derecha. */

import { useState, useEffect } from "react";

const _toastSubs = [];

export function adminToast(text, isErr = false) {
  _toastSubs.forEach((fn) => fn({ text, isErr, id: Date.now() + Math.random() }));
}

function ToastItem({ toast, onDone }) {
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const timer = setTimeout(() => setLeaving(true), 3500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onDone, 200);
    return () => clearTimeout(t);
  }, [leaving, onDone]);

  const open = shown && !leaving;
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 10,
        maxWidth: 320,
        fontSize: 14,
        color: "#fff",
        background: toast.isErr ? "#b3261e" : "#1f7a4d",
        boxShadow: "0 6px 20px rgba(0,0,0,.25)",
        transform: open ? "translateY(0)" : "translateY(8px)",
        opacity: open ? 1 : 0,
        transition: "transform 200ms var(--ease-out), opacity 200ms var(--ease-out)",
      }}
    >
      {toast.text}
    </div>
  );
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (t) => {
      setItems((prev) => [...prev, t]);
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
        <ToastItem
          key={t.id}
          toast={t}
          onDone={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
        />
      ))}
    </div>
  );
}
