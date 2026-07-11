/* VETA · punto de entrada de la app.
   Monta React, gestiona el routing por hash, los tweaks visuales (tema/paleta/
   densidad/animación) y el carrito. Enruta a la tienda pública o al panel
   #admin. */

import { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";

import "./styles/styles.css";

import { db } from "./lib/db.js";
import { PALETTES } from "./lib/palettes.js";
import { Nav } from "./components/Nav.jsx";
import { Footer } from "./components/Footer.jsx";
import { Home } from "./screens/Home.jsx";
import { Catalog } from "./screens/Catalog.jsx";
import { PDP } from "./screens/PDP.jsx";
import { Care } from "./screens/Care.jsx";
import { useCart } from "./cart/useCart.js";
import { CartDrawer } from "./cart/CartDrawer.jsx";
import { SearchOverlay } from "./cart/SearchOverlay.jsx";
import { SitePromoBanner } from "./cart/SitePromoBanner.jsx";
import { AdminPanel } from "./admin/AdminPanel.jsx";
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakColor,
  TweakRadio,
  TweakSlider,
  TweakText,
  TweakButton,
} from "./tweaks/TweaksPanel.jsx";

const TWEAK_DEFAULTS = {
  theme: "dark",
  palette: "mediterranean",
  animation: 1,
  density: "regular",
  magnetic: true,
  wa_phone: "573243147031",
};

// Aplica una paleta como custom properties en :root y marca el tema.
function applyPalette(name, theme) {
  const p = (PALETTES[name] || PALETTES.mediterranean)[theme] || PALETTES.mediterranean.light;
  const root = document.documentElement;
  Object.entries(p).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-theme", theme);
}

/* ─────────────────────────────────────────────
   Hash routing
   #home  |  #catalog  |  #catalog/anillos  |  #pdp/an-01  |  #care
   ───────────────────────────────────────────── */
function parseHash() {
  const raw = (location.hash || "#home").replace(/^#/, "");
  const [path, qs] = raw.split("?");
  const [name, arg] = path.split("/");
  const r = { name: name || "home" };
  if (name === "catalog" && arg) r.filter = arg;
  if (name === "pdp" && arg) r.id = arg;
  if (qs) {
    const p = new URLSearchParams(qs);
    if (p.has("q")) r.search = p.get("q");
  }
  return r;
}
function setHash(r) {
  let h = "#" + r.name;
  if (r.name === "catalog" && r.filter) h += "/" + r.filter;
  if (r.name === "pdp" && r.id) h += "/" + r.id;
  if (r.search) h += "?" + new URLSearchParams({ q: r.search }).toString();
  if (location.hash !== h) location.hash = h;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState(parseHash());
  const [cartOpen, setCartOpen] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [, forceUpdate] = useState(0);
  const cart = useCart();

  // Inicializar Supabase y re-renderizar cuando los datos lleguen
  useEffect(() => {
    db.init().then(() => forceUpdate((n) => n + 1));
    return db.onReady(() => forceUpdate((n) => n + 1));
  }, []);

  /* Aplica tweaks visuales */
  useEffect(() => {
    applyPalette(t.palette, t.theme);
  }, [t.palette, t.theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--anim-scale", String(t.animation));
    document.documentElement.setAttribute("data-density", t.density);
  }, [t.animation, t.density]);

  /* Routing */
  useEffect(() => {
    const onHash = () => {
      const r = parseHash();
      setRoute(r);
      if (r.name !== "pdp") window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = useCallback((r) => setHash(r), []);

  /* Agregar al carrito + abrir drawer + bump */
  const handleAdd = useCallback(
    (product, opts) => {
      cart.add(product, opts);
      setCartBump(true);
      setTimeout(() => setCartBump(false), 700);
      setTimeout(() => setCartOpen(true), 250);
    },
    [cart]
  );

  if (route.name === "admin") return <AdminPanel />;

  return (
    <>
      <Nav
        route={route}
        onNavigate={navigate}
        cartCount={cart.count}
        cartBump={cartBump}
        onCartOpen={() => setCartOpen(true)}
        onSearchOpen={() => setSearchOpen(true)}
        theme={t.theme}
        onThemeToggle={() => {
          const next = t.theme === "dark" ? "light" : "dark";
          const canAnimate =
            typeof document.startViewTransition === "function" &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (canAnimate) {
            // Aplica la paleta de forma imperativa dentro de la transición para
            // que la captura "after" no dependa del ciclo de render de React —
            // el crossfade lo compone el navegador (GPU), no se recalcula el
            // estilo de cada elemento en cada frame como con la transición CSS
            // de custom properties que usábamos antes. Envuelto en try/catch
            // porque el navegador puede abortar la transición (ej. clics muy
            // seguidos) — el cambio de tema ya se aplicó igual, solo se pierde
            // el crossfade en ese caso puntual.
            try {
              const transition = document.startViewTransition(() => {
                applyPalette(t.palette, next);
                setTweak("theme", next);
              });
              transition.finished.catch(() => {});
            } catch {
              setTweak("theme", next);
            }
          } else {
            setTweak("theme", next);
          }
        }}
      />
      {route.name !== "catalog" && <SitePromoBanner onOpenCart={() => setCartOpen(true)} />}

      {route.name === "home" && <Home onNavigate={navigate} onAdd={handleAdd} />}
      {route.name === "catalog" && (
        <Catalog filter={route.filter} search={route.search} onNavigate={navigate} />
      )}
      {route.name === "pdp" && <PDP id={route.id} onNavigate={navigate} onAdd={handleAdd} />}
      {route.name === "care" && <Care onNavigate={navigate} />}

      <Footer onNavigate={navigate} />

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={navigate} />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        waPhone={db.getSetting("wa_phone", t.wa_phone) || t.wa_phone}
      />

      <TweaksPanel title="Tweaks · VETA">
        <TweakSection label="Aspecto" />
        <TweakColor
          label="Paleta"
          value={
            (PALETTES[t.palette] || PALETTES.mediterranean)[t.theme]
              ? [
                  (PALETTES[t.palette] || PALETTES.mediterranean)[t.theme]["--bg"],
                  (PALETTES[t.palette] || PALETTES.mediterranean)[t.theme]["--ink"],
                  (PALETTES[t.palette] || PALETTES.mediterranean)[t.theme]["--accent"],
                ]
              : ["#ebe5dc", "#2b231b", "#a08866"]
          }
          options={[
            [
              PALETTES.mediterranean[t.theme]["--bg"],
              PALETTES.mediterranean[t.theme]["--ink"],
              PALETTES.mediterranean[t.theme]["--accent"],
            ],
            [
              PALETTES.porcelain[t.theme]["--bg"],
              PALETTES.porcelain[t.theme]["--ink"],
              PALETTES.porcelain[t.theme]["--accent"],
            ],
            [
              PALETTES.obsidian[t.theme]["--bg"],
              PALETTES.obsidian[t.theme]["--ink"],
              PALETTES.obsidian[t.theme]["--accent"],
            ],
          ]}
          onChange={(v) => {
            const names = ["mediterranean", "porcelain", "obsidian"];
            const idx = [
              PALETTES.mediterranean[t.theme]["--bg"],
              PALETTES.porcelain[t.theme]["--bg"],
              PALETTES.obsidian[t.theme]["--bg"],
            ].indexOf(v[0]);
            setTweak("palette", names[idx >= 0 ? idx : 0]);
          }}
        />
        <TweakRadio
          label="Tono"
          value={t.theme}
          options={["light", "dark"]}
          onChange={(v) => setTweak("theme", v)}
        />
        <TweakRadio
          label="Densidad"
          value={t.density}
          options={["compact", "regular", "airy"]}
          onChange={(v) => setTweak("density", v)}
        />

        <TweakSection label="Movimiento" />
        <TweakSlider
          label="Intensidad"
          value={t.animation}
          min={0}
          max={1.6}
          step={0.1}
          onChange={(v) => setTweak("animation", v)}
        />

        <TweakSection label="WhatsApp" />
        <TweakText
          label="Número"
          value={t.wa_phone}
          placeholder="521234567890"
          onChange={(v) => setTweak("wa_phone", v.replace(/[^0-9]/g, ""))}
        />

        <TweakSection label="Atajos" />
        <TweakButton label="Inicio" secondary onClick={() => navigate({ name: "home" })} />
        <TweakButton label="Catálogo" secondary onClick={() => navigate({ name: "catalog" })} />
        <TweakButton
          label="Ejemplo PDP"
          secondary
          onClick={() => navigate({ name: "pdp", id: "an-01" })}
        />
        <TweakButton label="Cuidado" secondary onClick={() => navigate({ name: "care" })} />
        <TweakButton label="Vaciar bolsa" secondary onClick={() => cart.clear()} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
