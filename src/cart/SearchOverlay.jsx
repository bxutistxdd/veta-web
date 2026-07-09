/* VETA · overlay de búsqueda global (se abre desde el nav).
   Muestra hasta 6 resultados en vivo con enlace directo al PDP o al catálogo
   filtrado por la consulta. */

import { useState, useEffect, useRef, useMemo } from "react";
import { VETA_DATA } from "../lib/data.js";
import { db } from "../lib/db.js";
import { visibleProducts } from "../lib/catalog.js";
import { searchProducts } from "../lib/search.js";
import { PHShape } from "../components/primitives.jsx";

const SEARCH_HINTS = ["Anillo plata 925", "Collar fino", "Arete argolla", "Piercing acero"];

export function SearchOverlay({ open, onClose, onNavigate }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 60);
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const allProducts = useMemo(() => visibleProducts(), [open]);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    return searchProducts(q, allProducts);
  }, [q, allProducts]);

  const top = results.slice(0, 6);

  const goTo = (r) => {
    onNavigate(r);
    onClose();
  };
  const goFull = () => {
    if (q.trim()) goTo({ name: "catalog", search: q.trim() });
  };

  return (
    <>
      <div className={`search-scrim${open ? " search-scrim--on" : ""}`} onClick={onClose} />
      <div
        className={`search-panel${open ? " search-panel--on" : ""}`}
        role="dialog"
        aria-label="Búsqueda"
        aria-modal="true"
      >
        <div className="search-input-row">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="18"
            height="18"
            className="search-icon"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.5-4.5" />
          </svg>
          <input
            ref={inputRef}
            className="search-field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goFull()}
            placeholder="Busca por nombre, material, categoría…"
            aria-label="Buscar productos"
          />
          {q && (
            <button
              className="search-clear"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              aria-label="Limpiar"
            >
              ×
            </button>
          )}
          <button className="search-close-btn" onClick={onClose} aria-label="Cerrar">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              width="17"
              height="17"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {q.trim() ? (
          <div className="search-results-panel">
            {top.length === 0 ? (
              <div className="search-empty">
                <p>
                  Sin resultados para <em>"{q}"</em>.
                </p>
                <button className="search-browse-btn" onClick={() => goTo({ name: "catalog" })}>
                  Ver todo el catálogo →
                </button>
              </div>
            ) : (
              <>
                <p className="search-count">
                  {results.length} {results.length === 1 ? "resultado" : "resultados"}
                </p>
                <div className="search-results-list">
                  {top.map((p) => {
                    const catLabel =
                      db.getCategoryLabel(p.cat) ||
                      VETA_DATA.categories.find((c) => c.id === p.cat)?.label;
                    const shape = VETA_DATA.shapes[p.cat]?.kind || "ring";
                    const thumb = VETA_DATA.productImages(p)[0];
                    return (
                      <button
                        key={p.id}
                        className="search-result-item"
                        onClick={() => goTo({ name: "pdp", id: p.id })}
                      >
                        <div className="search-result-thumb">
                          {thumb ? (
                            <img src={thumb} alt="" loading="lazy" />
                          ) : (
                            <PHShape kind={shape} />
                          )}
                        </div>
                        <div className="search-result-body">
                          <span className="search-result-name">{p.name}</span>
                          <span className="search-result-meta">
                            {p.material} · {catLabel}
                          </span>
                        </div>
                        <span className="search-result-price">{VETA_DATA.fmtPrice(p.price)}</span>
                      </button>
                    );
                  })}
                </div>
                {results.length > 6 && (
                  <button className="search-all-btn" onClick={goFull}>
                    Ver todos los resultados ({results.length}) →
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="search-hints-panel">
            <span className="search-hints-label">Búsquedas frecuentes</span>
            <div className="search-hints-row">
              {SEARCH_HINTS.map((h) => (
                <button key={h} className="search-hint-chip" onClick={() => setQ(h)}>
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
