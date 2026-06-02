/* VETA · App raíz
   - Routing por hash
   - Cart en localStorage
   - Tweaks (paleta, animación, densidad)
   - Cart drawer + export a WhatsApp
*/

const TWEAK_DEFAULTS = {
  "theme": "dark",
  "palette": "mediterranean",
  "animation": 1,
  "density": "regular",
  "magnetic": true,
  "wa_phone": "573246206702"
};

/* Paletas — todas comparten estructura */
const PALETTES = {
  mediterranean: {
    light: { "--bg":"#ebe5dc","--bg-elev":"#f3eee6","--bg-soft":"#ded5c7","--ink":"#2b231b","--ink-soft":"#6b5a48","--ink-faint":"#a08866","--line":"rgba(43,35,27,.10)","--accent":"#a08866","--accent-2":"#c9b896" },
    dark:  { "--bg":"#14110d","--bg-elev":"#1c1814","--bg-soft":"#221d18","--ink":"#ebe5dc","--ink-soft":"#a89884","--ink-faint":"#6b5a48","--line":"rgba(235,229,220,.08)","--accent":"#c9a978","--accent-2":"#8a7253" },
  },
  porcelain: {
    light: { "--bg":"#f6f4ef","--bg-elev":"#ffffff","--bg-soft":"#e9e6df","--ink":"#1a1a1a","--ink-soft":"#5a5a5a","--ink-faint":"#9a9a9a","--line":"rgba(26,26,26,.10)","--accent":"#b8956a","--accent-2":"#d4af37" },
    dark:  { "--bg":"#0f0f0f","--bg-elev":"#181818","--bg-soft":"#1f1f1f","--ink":"#f6f4ef","--ink-soft":"#9a9a9a","--ink-faint":"#5a5a5a","--line":"rgba(246,244,239,.08)","--accent":"#d4af37","--accent-2":"#8a7253" },
  },
  obsidian: {
    light: { "--bg":"#e8e6e1","--bg-elev":"#f1efea","--bg-soft":"#d6d3cb","--ink":"#0a0a0a","--ink-soft":"#525252","--ink-faint":"#8a8a8a","--line":"rgba(10,10,10,.10)","--accent":"#3d342d","--accent-2":"#8b7355" },
    dark:  { "--bg":"#0a0a0a","--bg-elev":"#141414","--bg-soft":"#1a1a1a","--ink":"#e8e6e1","--ink-soft":"#9a9a9a","--ink-faint":"#5a5a5a","--line":"rgba(232,230,225,.08)","--accent":"#b8956a","--accent-2":"#6b5a48" },
  },
};

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
  if (qs) { const p = new URLSearchParams(qs); if (p.has("q")) r.search = p.get("q"); }
  return r;
}
function setHash(r) {
  let h = "#" + r.name;
  if (r.name === "catalog" && r.filter) h += "/" + r.filter;
  if (r.name === "pdp" && r.id) h += "/" + r.id;
  if (r.search) h += "?" + new URLSearchParams({ q: r.search }).toString();
  if (location.hash !== h) location.hash = h;
}

/* ─────────────────────────────────────────────
   Cart hook
   ───────────────────────────────────────────── */
function useCart() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("veta-cart") || "[]"); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem("veta-cart", JSON.stringify(items));
  }, [items]);

  const add = useCallback((product, opts) => {
    setItems((prev) => {
      const key  = `${product.id}::${opts.size}::${opts.finish}`;
      const idx  = prev.findIndex((it) => it.key === key);
      const cur  = idx >= 0 ? prev[idx].qty : 0;
      const req  = opts.qty || 1;
      const stock = window.VETA_ADMIN?.getStock(product.id, opts.size);
      const cap  = (stock !== null && stock !== undefined) ? stock : Infinity;
      const newQty = Math.min(cur + req, cap);
      if (newQty <= 0) return prev;
      if (idx >= 0) {
        if (newQty === prev[idx].qty) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], qty: newQty };
        return next;
      }
      return [...prev, { key, id: product.id, name: product.name, price: product.price, material: product.material, size: opts.size, finish: opts.finish, qty: newQty, img: product.images?.main || null, shape: VETA_DATA.shapes[product.cat]?.kind || "ring" }];
    });
  }, []);
  const remove = useCallback((key) => setItems((prev) => prev.filter((it) => it.key !== key)), []);
  const setQty = useCallback((key, qty) => setItems((prev) => {
    if (qty <= 0) return prev.filter((it) => it.key !== key);
    const item = prev.find(it => it.key === key);
    if (!item) return prev;
    const stock = window.VETA_ADMIN?.getStock(item.id, item.size);
    const cap   = (stock !== null && stock !== undefined) ? stock : Infinity;
    return prev.map((it) => it.key === key ? { ...it, qty: Math.min(qty, cap) } : it);
  }), []);
  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((a, it) => a + it.qty, 0);
  const subtotal = items.reduce((a, it) => a + it.qty * it.price, 0);

  return { items, add, remove, setQty, clear, count, subtotal };
}

/* ─────────────────────────────────────────────
   Cart Drawer
   ───────────────────────────────────────────── */
function CartDrawer({ open, onClose, cart, waPhone }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const toWhatsApp = () => {
    if (cart.items.length === 0) return;
    const lines = cart.items.map((it) =>
      `• ${it.name} (${it.material}, ${it.finish}, talla ${it.size}) x${it.qty} — ${VETA_DATA.fmtPrice(it.price * it.qty)} COP`
    );
    const msg = [
      "Hola VETA, me interesa esta selección:",
      "",
      ...lines,
      "",
      `Subtotal: ${VETA_DATA.fmtPrice(cart.subtotal)} COP`,
      "",
      "¿Me confirman disponibilidad y envío?",
    ].join("\n");
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <>
      <div className="cart-scrim" data-on={open ? "1" : "0"} onClick={onClose} />
      <aside className="cart-drawer" data-on={open ? "1" : "0"} aria-hidden={!open}>
        <header className="cart-head">
          <h3>Tu bolsa</h3>
          <button className="cart-close" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="cart-body">
          {cart.items.length === 0 ? (
            <div className="cart-empty">
              <div className="serif" style={{ fontSize: 28, fontWeight: 300, fontStyle: "italic", color: "var(--ink)" }}>
                Aún sin piezas.
              </div>
              <p className="body" style={{ maxWidth: 30, minWidth: 240 }}>
                Las elecciones aparecerán aquí antes de pasar a WhatsApp.
              </p>
              <button className="btn btn--ghost" onClick={() => { onClose(); location.hash = "catalog"; }} style={{ marginTop: 16 }}>
                Explorar catálogo
              </button>
            </div>
          ) : cart.items.map((it) => {
            const st = getStockStatus(it.id, it.size);
            const atLimit = st.qty !== null && it.qty >= st.qty;
            return (
              <div key={it.key} className={`cart-item${st.status === "out" ? " cart-item--out" : ""}`}>
                <Placeholder shape={it.shape} tag={it.id.toUpperCase()} img={it.img || undefined} />
                <div>
                  <h4>{it.name}</h4>
                  <div className="vmeta">{it.material} · {it.finish} · Talla {it.size}</div>
                  {st.status === "low" && (
                    <span className="cart-stock-badge cart-stock-badge--low">Solo quedan {st.qty}</span>
                  )}
                  {st.status === "out" && (
                    <span className="cart-stock-badge cart-stock-badge--out">Agotado — quitar del pedido</span>
                  )}
                  <div className="cart-qty">
                    <button onClick={() => cart.setQty(it.key, it.qty - 1)} aria-label="Menos">−</button>
                    <span>{it.qty}</span>
                    <button onClick={() => cart.setQty(it.key, it.qty + 1)} disabled={atLimit || st.status === "out"} aria-label="Más">+</button>
                  </div>
                </div>
                <div className="cart-item-side">
                  <span className="price">{VETA_DATA.fmtPrice(it.price * it.qty)}</span>
                  <button className="remove" onClick={() => cart.remove(it.key)}>Quitar</button>
                </div>
              </div>
            );
          })}
        </div>
        {cart.items.length > 0 && (
          <footer className="cart-foot">
            <div className="cart-totals">
              <div className="row"><span>Subtotal estimado</span><span>{VETA_DATA.fmtPrice(cart.subtotal)} COP</span></div>
              <div className="row"><span>Envío</span><span>Se confirma por WhatsApp</span></div>
              <div className="row total"><span>Total estimado</span><span>{VETA_DATA.fmtPrice(cart.subtotal)} COP</span></div>
            </div>
            <Magnetic strength={0.1}>
              <button className="btn btn-wa" style={{ width: "100%" }} onClick={toWhatsApp}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: "middle", marginRight: 2 }} aria-hidden="true">
                  <path d="M20.5 3.5A11 11 0 0 0 3.4 17.6L2 22l4.5-1.4a11 11 0 0 0 5.5 1.5h0a11 11 0 0 0 11-11 11 11 0 0 0-2.5-7.6Zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-2.7.9.9-2.6-.2-.3a9 9 0 1 1 6.9 3.4Zm5-6.7c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.6.1a7 7 0 0 1-3.6-3.2c-.3-.5.3-.4.7-1.3.1-.2 0-.4 0-.5 0-.1-.7-1.7-1-2.3-.2-.6-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.4a3 3 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.7.2.2 2 3 4.7 4.2 1.7.7 2.3.8 3.1.6.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.2-.2-.5-.4Z"/>
                </svg>
                Continuar por WhatsApp
              </button>
            </Magnetic>
            <p className="caption" style={{ textAlign: "center", margin: 0 }}>
              Concretamos la venta y el envío contigo, persona a persona.
            </p>
          </footer>
        )}
      </aside>
    </>
  );
}

/* ─────────────────────────────────────────────
   Search overlay global
   ───────────────────────────────────────────── */
const SEARCH_HINTS = ["Anillo plata 925", "Collar fino", "Arete argolla", "Piercing acero"];

function SearchOverlay({ open, onClose, onNavigate }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) { setQ(""); return; }
    setTimeout(() => inputRef.current?.focus(), 60);
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  const allProducts = useMemo(() => visibleProducts(), [open]);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    return searchProducts(q, allProducts);
  }, [q, allProducts]);

  const top = results.slice(0, 6);

  const goTo = (r) => { onNavigate(r); onClose(); };
  const goFull = () => { if (q.trim()) goTo({ name: "catalog", search: q.trim() }); };

  return (
    <>
      <div className={`search-scrim${open ? " search-scrim--on" : ""}`} onClick={onClose} />
      <div className={`search-panel${open ? " search-panel--on" : ""}`} role="dialog" aria-label="Búsqueda" aria-modal="true">
        <div className="search-input-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" className="search-icon" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" />
          </svg>
          <input
            ref={inputRef}
            className="search-field"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && goFull()}
            placeholder="Busca por nombre, material, categoría…"
            aria-label="Buscar productos"
          />
          {q && (
            <button className="search-clear" onClick={() => { setQ(""); inputRef.current?.focus(); }} aria-label="Limpiar">×</button>
          )}
          <button className="search-close-btn" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="17" height="17" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {q.trim() ? (
          <div className="search-results-panel">
            {top.length === 0 ? (
              <div className="search-empty">
                <p>Sin resultados para <em>"{q}"</em>.</p>
                <button className="search-browse-btn" onClick={() => goTo({ name: "catalog" })}>Ver todo el catálogo →</button>
              </div>
            ) : (
              <>
                <p className="search-count">{results.length} {results.length === 1 ? "resultado" : "resultados"}</p>
                <div className="search-results-list">
                  {top.map(p => {
                    const cat = VETA_DATA.categories.find(c => c.id === p.cat);
                    const shape = VETA_DATA.shapes[p.cat]?.kind || "ring";
                    return (
                      <button key={p.id} className="search-result-item" onClick={() => goTo({ name: "pdp", id: p.id })}>
                        <div className="search-result-thumb">
                          {p.images?.main
                            ? <img src={p.images.main} alt="" loading="lazy" />
                            : <PHShape kind={shape} />}
                        </div>
                        <div className="search-result-body">
                          <span className="search-result-name">{p.name}</span>
                          <span className="search-result-meta">{p.material} · {cat?.label}</span>
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
              {SEARCH_HINTS.map(h => (
                <button key={h} className="search-hint-chip" onClick={() => setQ(h)}>{h}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   App
   ───────────────────────────────────────────── */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState(parseHash());
  const [cartOpen, setCartOpen] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const cart = useCart();

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
  const handleAdd = useCallback((product, opts) => {
    cart.add(product, opts);
    setCartBump(true);
    setTimeout(() => setCartBump(false), 700);
    setTimeout(() => setCartOpen(true), 250);
  }, [cart]);

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
        onThemeToggle={() => setTweak("theme", t.theme === "dark" ? "light" : "dark")}
      />

      {route.name === "home"    && <Home    onNavigate={navigate} onAdd={handleAdd} />}
      {route.name === "catalog" && <Catalog filter={route.filter} search={route.search} onNavigate={navigate} />}
      {route.name === "pdp"     && <PDP     id={route.id} onNavigate={navigate} onAdd={handleAdd} />}
      {route.name === "care"    && <Care    onNavigate={navigate} />}

      <Footer onNavigate={navigate} />

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={navigate} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} waPhone={t.wa_phone} />

      <TweaksPanel title="Tweaks · VETA">
        <TweakSection label="Aspecto" />
        <TweakColor
          label="Paleta"
          value={ (PALETTES[t.palette]||PALETTES.mediterranean)[t.theme]
            ? [
                (PALETTES[t.palette]||PALETTES.mediterranean)[t.theme]["--bg"],
                (PALETTES[t.palette]||PALETTES.mediterranean)[t.theme]["--ink"],
                (PALETTES[t.palette]||PALETTES.mediterranean)[t.theme]["--accent"],
              ]
            : ["#ebe5dc","#2b231b","#a08866"] }
          options={[
            [PALETTES.mediterranean[t.theme]["--bg"], PALETTES.mediterranean[t.theme]["--ink"], PALETTES.mediterranean[t.theme]["--accent"]],
            [PALETTES.porcelain[t.theme]["--bg"],     PALETTES.porcelain[t.theme]["--ink"],     PALETTES.porcelain[t.theme]["--accent"]],
            [PALETTES.obsidian[t.theme]["--bg"],      PALETTES.obsidian[t.theme]["--ink"],      PALETTES.obsidian[t.theme]["--accent"]],
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
        <TweakRadio label="Tono" value={t.theme} options={["light","dark"]} onChange={(v) => setTweak("theme", v)} />
        <TweakRadio label="Densidad" value={t.density} options={["compact","regular","airy"]} onChange={(v) => setTweak("density", v)} />

        <TweakSection label="Movimiento" />
        <TweakSlider label="Intensidad" value={t.animation} min={0} max={1.6} step={0.1} onChange={(v) => setTweak("animation", v)} />

        <TweakSection label="WhatsApp" />
        <TweakText label="Número" value={t.wa_phone} placeholder="521234567890" onChange={(v) => setTweak("wa_phone", v.replace(/[^0-9]/g,""))} />

        <TweakSection label="Atajos" />
        <TweakButton label="Inicio" secondary onClick={() => navigate({ name: "home" })} />
        <TweakButton label="Catálogo" secondary onClick={() => navigate({ name: "catalog" })} />
        <TweakButton label="Ejemplo PDP" secondary onClick={() => navigate({ name: "pdp", id: "an-01" })} />
        <TweakButton label="Cuidado" secondary onClick={() => navigate({ name: "care" })} />
        <TweakButton label="Vaciar bolsa" secondary onClick={() => cart.clear()} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
