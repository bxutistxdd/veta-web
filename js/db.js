/* VETA · Supabase data layer
   Un solo cliente (anon key). Las lecturas son públicas.
   Las escrituras del panel admin requieren sesión iniciada (Supabase Auth):
   tras el login, el cliente lleva el JWT y las políticas RLS permiten escribir
   solo al rol `authenticated`. Ya NO se usa la service key en el navegador.
*/
window.VETA_DB = (function () {
  const URL   = "https://ojixjsrzpgpxaikuqffk.supabase.co";
  const ANON  = "sb_publishable_Bk4RqsWf2y-miJTfuqSg9Q_XhjNMG5N";
  // Correo fijo del único administrador. La pantalla de login solo pide la
  // contraseña; el correo se usa internamente.
  const ADMIN_EMAIL = "admin@vetajoyeria.co";

  const sb = supabase.createClient(URL, ANON, {
    auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
  });

  // Caché en memoria
  let _products = null;
  let _stock    = {};
  let _settings = {};
  let _ready    = false;
  let _listeners = [];

  function _notify() { _listeners.forEach(fn => fn()); }

  /* ── helpers ── */
  function _mapProduct(row) {
    return {
      id:       row.id,
      name:     row.name,
      cat:      row.cat,
      material: row.material,
      finish:   row.finish,
      price:    row.price,
      sizes:    row.sizes || [],
      blurb:    row.blurb || "",
      desc:     row.description || "",
      images:   row.images || {},
      visible:  row.visible,
      featured: row.featured,
    };
  }

  /* ── carga de datos ── */
  async function loadProducts() {
    const { data, error } = await sb.from("products").select("*").order("cat");
    if (error) { console.warn("[VETA_DB] products:", error.message); return; }
    _products = data.map(_mapProduct);
    window.VETA_PRODUCTS = _products;
  }

  async function loadStock() {
    const { data, error } = await sb.from("stock").select("*");
    if (error) { console.warn("[VETA_DB] stock:", error.message); return; }
    _stock = {};
    data.forEach(r => { _stock[r.product_id + "::" + r.size] = r.qty; });
    window.VETA_STOCK = _stock;
  }

  async function loadSettings() {
    const { data, error } = await sb.from("settings").select("*");
    if (error) return;
    _settings = {};
    data.forEach(r => { _settings[r.key] = r.value; });
  }

  async function init() {
    await Promise.all([loadProducts(), loadStock(), loadSettings()]);
    _ready = true;
    _notify();

    // Suscripción en tiempo real — stock
    sb.channel("stock-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock" }, async () => {
        await loadStock();
        _notify();
      })
      .subscribe();

    // Suscripción en tiempo real — products
    sb.channel("products-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, async () => {
        await loadProducts();
        _notify();
      })
      .subscribe();

    return { products: _products, stock: _stock, settings: _settings };
  }

  /* ── lecturas ── */
  function getProducts() {
    return _products || window.VETA_PRODUCTS || VETA_DATA.products;
  }

  function getStock(productId, size) {
    const v = _stock[productId + "::" + size];
    return v === undefined ? null : v;
  }

  function getSetting(key, fallback) {
    return _settings[key] !== undefined ? _settings[key] : fallback;
  }

  function isHidden(id) {
    const p = (_products || []).find(x => x.id === id);
    return p ? p.visible === false : false;
  }

  function onReady(fn) {
    if (_ready) { fn(); return () => {}; }
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  }

  // Suscripción persistente: se llama en cada cambio (carga inicial, realtime,
  // o tras una escritura del admin). Útil para que el panel refleje cambios en vivo.
  function subscribe(fn) {
    _listeners.push(fn);
    if (_ready) fn();
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  }

  /* ── autenticación admin ── */
  async function signIn(password) {
    const { data, error } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
    return { ok: !error, error: error ? error.message : null, session: data?.session || null };
  }
  async function signOut() { await sb.auth.signOut(); }
  async function getSession() {
    const { data } = await sb.auth.getSession();
    return data?.session || null;
  }
  function onAuthChange(fn) {
    const { data } = sb.auth.onAuthStateChange((_event, session) => fn(session));
    return () => data?.subscription?.unsubscribe?.();
  }
  async function changePassword(newPassword) {
    const { error } = await sb.auth.updateUser({ password: newPassword });
    return { ok: !error, error: error ? error.message : null };
  }

  /* ── escrituras admin (requieren sesión) ── */
  async function setStock(productId, size, qty) {
    if (qty == null || qty < 0) {
      // Cantidad negativa = "sin definir": borrar la fila
      const { error } = await sb.from("stock").delete().match({ product_id: productId, size });
      if (error) throw error;
      delete _stock[productId + "::" + size];
    } else {
      const { error } = await sb.from("stock")
        .upsert({ product_id: productId, size, qty }, { onConflict: "product_id,size" });
      if (error) throw error;
      _stock[productId + "::" + size] = qty;
    }
    window.VETA_STOCK = _stock;
    _notify();
  }

  async function clearStock() {
    const { error } = await sb.from("stock").delete().neq("product_id", "");
    if (error) throw error;
    _stock = {};
    window.VETA_STOCK = _stock;
    _notify();
  }

  async function setVisible(productId, visible) {
    const { error } = await sb.from("products")
      .update({ visible }).eq("id", productId);
    if (error) throw error;
    if (_products) {
      _products = _products.map(p => p.id === productId ? { ...p, visible } : p);
      window.VETA_PRODUCTS = _products;
    }
    _notify();
  }

  async function upsertProduct(product) {
    const row = {
      id:          product.id,
      name:        product.name,
      cat:         product.cat,
      material:    product.material,
      finish:      product.finish,
      price:       Number(product.price),
      sizes:       product.sizes,
      blurb:       product.blurb || "",
      description: product.desc || "",
      images:      product.images || {},
      visible:     product.visible !== false,
      featured:    product.featured || false,
    };
    const { error } = await sb.from("products").upsert(row, { onConflict: "id" });
    if (error) throw error;
    await loadProducts();
    _notify();
  }

  async function deleteProduct(id) {
    const { error } = await sb.from("products").delete().eq("id", id);
    if (error) throw error;
    if (_products) {
      _products = _products.filter(p => p.id !== id);
      window.VETA_PRODUCTS = _products;
    }
    _notify();
  }

  async function saveSetting(key, value) {
    const { error } = await sb.from("settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) throw error;
    _settings[key] = value;
    _notify();
  }

  return {
    init, onReady, subscribe,
    getProducts, getStock, getSetting, isHidden,
    signIn, signOut, getSession, onAuthChange, changePassword,
    setStock, clearStock, setVisible, upsertProduct, deleteProduct, saveSetting,
    sb,
  };
})();
