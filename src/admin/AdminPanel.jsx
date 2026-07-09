/* VETA admin · raíz del panel.
   AdminPanel gestiona el login; AdminShell arma el layout (sidebar + menú móvil)
   y monta la pestaña activa. */

import { useState, useEffect, useCallback } from "react";
import { db } from "../lib/db.js";
import { ADMIN_TABS } from "./constants.js";
import { adminToast, Toaster } from "./toast.jsx";
import { useAuth, useProducts, useStock, useCfg, useChatBadge, useDespBadge } from "./hooks.js";
import { AdminLogin } from "./AdminLogin.jsx";
import { TabInicio } from "./tabs/TabInicio.jsx";
import { TabChats } from "./tabs/TabChats.jsx";
import { TabDespachos } from "./tabs/TabDespachos.jsx";
import { TabProductos } from "./tabs/TabProductos.jsx";
import { TabCategorias } from "./tabs/TabCategorias.jsx";
import { TabStock } from "./tabs/TabStock.jsx";
import { TabDescuentos } from "./tabs/TabDescuentos.jsx";
import { TabConfig } from "./tabs/TabConfig.jsx";

function AdminShell({ onLogout }) {
  const [tab, setTab] = useState("inicio");
  const [menuOpen, setMenuOpen] = useState(false);
  const { products: rawProducts, add, update, remove, resetToSeed } = useProducts();
  const { stock, set: setStock, get: getStock, reset: resetStock } = useStock();
  const { cfg, save: saveCfg } = useCfg();
  const chatBadge = useChatBadge();
  const despBadge = useDespBadge();

  // Bloquear scroll del body cuando el menú está abierto
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Cerrar con Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const goTab = (id) => {
    setTab(id);
    setMenuOpen(false);
  };

  const toggleHidden = useCallback(async (id) => {
    const p = (db.getProducts() || []).find((x) => x.id === id);
    const currentlyVisible = p ? p.visible !== false : true;
    try {
      await db.setVisible(id, !currentlyVisible);
    } catch (e) {
      adminToast("No se pudo cambiar la visibilidad: " + e.message, true);
    }
  }, []);

  const toggleFeatured = useCallback(async (id) => {
    const p = (db.getProducts() || []).find((x) => x.id === id);
    const currentlyFeatured = p ? p.featured === true : false;
    try {
      await db.setFeatured(id, !currentlyFeatured);
    } catch (e) {
      adminToast("No se pudo cambiar el destacado: " + e.message, true);
    }
  }, []);

  const products = rawProducts.map((p) => ({ ...p, hidden: p.visible === false }));

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar">
        <div className="adm-sb-top">
          <span className="adm-sb-logo">VETA</span>
          <span className="adm-sb-badge">Admin</span>
        </div>
        <nav className="adm-sb-nav">
          {ADMIN_TABS.map((t) => (
            <button
              key={t.id}
              className={`adm-sb-btn${tab === t.id ? " adm-sb-btn--on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "chats" && chatBadge > 0 && (
                <span className="adm-sb-badge-count">{chatBadge}</span>
              )}
              {t.id === "despachos" && despBadge > 0 && (
                <span className="adm-sb-badge-count">{despBadge}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="adm-sb-foot">
          <a href="#home" className="adm-sb-link">
            ← Ver tienda
          </a>
          <button
            className="adm-sb-link"
            onClick={onLogout}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textAlign: "left",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className={`adm-body${tab === "chats" ? " adm-body--chat" : ""}`}>
        <header className="adm-hdr">
          <h1 className="adm-hdr-title">{ADMIN_TABS.find((t) => t.id === tab)?.label}</h1>
          <span className="adm-hdr-meta">VETA · Panel en la nube</span>
          {/* Dropdown de navegación — solo visible en móvil, solo en Chats */}
          {tab === "chats" && (
            <div className="adm-hdr-tab-nav">
              <select
                className="adm-hdr-tab-select"
                value={tab}
                onChange={(e) => goTab(e.target.value)}
                aria-label="Navegar entre secciones"
              >
                {ADMIN_TABS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
              <span className="adm-hdr-tab-chevron" aria-hidden="true">
                ▾
              </span>
            </div>
          )}
          {/* Hamburguesa — solo visible en móvil */}
          <button
            className="adm-hdr-hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
          >
            <span className="adm-hdr-hamburger-icon" data-open={menuOpen ? "1" : "0"}>
              <span />
              <span />
              <span />
            </span>
          </button>
        </header>
        <div className="adm-content">
          {tab === "inicio" && <TabInicio products={products} stock={stock} />}
          {tab === "chats" && <TabChats goTab={goTab} />}
          {tab === "despachos" && <TabDespachos />}
          {tab === "productos" && (
            <TabProductos
              products={products}
              addProduct={add}
              updateProduct={update}
              removeProduct={remove}
              toggleHidden={toggleHidden}
              toggleFeatured={toggleFeatured}
            />
          )}
          {tab === "categorias" && <TabCategorias />}
          {tab === "stock" && (
            <TabStock products={products} get={getStock} set={setStock} reset={resetStock} />
          )}
          {tab === "descuentos" && <TabDescuentos />}
          {tab === "config" && (
            <TabConfig cfg={cfg} save={saveCfg} onLogout={onLogout} resetProducts={resetToSeed} />
          )}
        </div>
      </div>

      {/* Menú fullscreen móvil */}
      <div className="adm-mob-menu" data-on={menuOpen ? "1" : "0"} aria-hidden={!menuOpen}>
        <div className="adm-mob-menu-hdr">
          <span className="adm-mob-menu-brand">VETA</span>
          <span className="adm-mob-menu-section">Panel de administración</span>
        </div>
        <nav className="adm-mob-menu-nav">
          {ADMIN_TABS.map((t, idx) => (
            <button
              key={t.id}
              className={`adm-mob-menu-link${tab === t.id ? " adm-mob-menu-link--on" : ""}`}
              onClick={() => goTab(t.id)}
              tabIndex={menuOpen ? 0 : -1}
            >
              <span className="adm-mob-menu-num">{String(idx + 1).padStart(2, "0")}</span>
              <span className="adm-mob-menu-text">
                <span className="adm-mob-menu-label">{t.label}</span>
                <span className="adm-mob-menu-desc">{t.desc}</span>
              </span>
              {t.id === "chats" && chatBadge > 0 && (
                <span className="adm-mob-menu-badge">{chatBadge}</span>
              )}
              {t.id === "despachos" && despBadge > 0 && (
                <span className="adm-mob-menu-badge">{despBadge}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="adm-mob-menu-foot">
          <a href="#home" className="adm-sb-link" onClick={() => setMenuOpen(false)}>
            ← Ver tienda
          </a>
          <button
            className="adm-sb-link"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onClick={onLogout}
            tabIndex={menuOpen ? 0 : -1}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPanel() {
  const { authed, ready, loading, err, login, logout } = useAuth();
  return (
    <>
      {!ready ? (
        <div className="adm-login-wrap">
          <div className="adm-login-card">
            <div className="adm-login-logo">VETA</div>
            <p className="adm-login-sub">Cargando…</p>
          </div>
        </div>
      ) : authed ? (
        <AdminShell onLogout={logout} />
      ) : (
        <AdminLogin onLogin={login} loading={loading} err={err} />
      )}
      <Toaster />
    </>
  );
}
