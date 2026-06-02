/* VETA · Supabase data layer
   Cliente público (anon) para lectura pública.
   Cliente admin (service role) para escrituras desde el panel.
   Ambos disponibles en window.VETA_DB.
*/
window.VETA_DB = (function () {
  const URL  = "https://ojixjsrzpgpxaikuqffk.supabase.co";
  const ANON = "sb_publishable_Bk4RqsWf2y-miJTfuqSg9Q_XhjNMG5N";
  // La service key se carga desde js/config.local.js (gitignoreado)
  // Si no existe, las escrituras del admin usan la anon key con políticas abiertas
  const SVC  = (window.VETA_CONFIG && window.VETA_CONFIG.serviceKey) || ANON;

  const pub   = supabase.createClient(URL, ANON);
  const admin = supabase.createClient(URL, SVC);

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
    const { data, error } = await pub.from("products").select("*").order("cat");
    if (error) { console.warn("[VETA_DB] products:", error.message); return; }
    _products = data.map(_mapProduct);
    window.VETA_PRODUCTS = _products;
  }

  async function loadStock() {
    const { data, error } = await pub.from("stock").select("*");
    if (error) { console.warn("[VETA_DB] stock:", error.message); return; }
    _stock = {};
    data.forEach(r => { _stock[r.product_id + "::" + r.size] = r.qty; });
    window.VETA_STOCK = _stock;
  }

  async function loadSettings() {
    const { data, error } = await pub.from("settings").select("*");
    if (error) return;
    _settings = {};
    data.forEach(r => { _settings[r.key] = r.value; });
  }

  async function init() {
    await Promise.all([loadProducts(), loadStock(), loadSettings()]);
    _ready = true;
    _notify();

    // Suscripción en tiempo real — stock
    pub.channel("stock-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock" }, async () => {
        await loadStock();
        _notify();
      })
      .subscribe();

    // Suscripción en tiempo real — products
    pub.channel("products-rt")
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
    // Fallback a localStorage (admin panel legacy)
    if (v === undefined) {
      try {
        const ls = JSON.parse(localStorage.getItem("veta-stock") || "{}");
        return ls[productId + "::" + size] ?? null;
      } catch { return null; }
    }
    return v;
  }

  function getSetting(key, fallback) {
    return _settings[key] !== undefined ? _settings[key] : fallback;
  }

  function isHidden(id) {
    const p = (_products || []).find(x => x.id === id);
    if (p) return p.visible === false;
    try {
      return (JSON.parse(localStorage.getItem("veta-hidden") || "[]")).includes(id);
    } catch { return false; }
  }

  function onReady(fn) {
    if (_ready) { fn(); return () => {}; }
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  }

  /* ── escrituras admin ── */
  async function setStock(productId, size, qty) {
    const { error } = await admin.from("stock")
      .upsert({ product_id: productId, size, qty }, { onConflict: "product_id,size" });
    if (error) throw error;
    _stock[productId + "::" + size] = qty;
    window.VETA_STOCK = _stock;
    // también localStorage para compatibilidad
    try {
      const ls = JSON.parse(localStorage.getItem("veta-stock") || "{}");
      ls[productId + "::" + size] = qty;
      localStorage.setItem("veta-stock", JSON.stringify(ls));
    } catch {}
  }

  async function setVisible(productId, visible) {
    const { error } = await admin.from("products")
      .update({ visible }).eq("id", productId);
    if (error) throw error;
    if (_products) {
      _products = _products.map(p => p.id === productId ? { ...p, visible } : p);
      window.VETA_PRODUCTS = _products;
    }
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
    const { error } = await admin.from("products").upsert(row, { onConflict: "id" });
    if (error) throw error;
    await loadProducts();
  }

  async function deleteProduct(id) {
    const { error } = await admin.from("products").delete().eq("id", id);
    if (error) throw error;
    if (_products) {
      _products = _products.filter(p => p.id !== id);
      window.VETA_PRODUCTS = _products;
    }
  }

  async function saveSetting(key, value) {
    const { error } = await admin.from("settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) throw error;
    _settings[key] = value;
  }

  return {
    init, onReady,
    getProducts, getStock, getSetting, isHidden,
    setStock, setVisible, upsertProduct, deleteProduct, saveSetting,
    pub, admin,
  };
})();
