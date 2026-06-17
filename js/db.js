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
  let _products      = null;
  let _stock         = {};
  let _settings      = {};
  let _discountCodes = [];
  let _ready         = false;
  let _listeners     = [];

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

  async function loadDiscountCodes() {
    const { data, error } = await sb.from("discount_codes").select("*").order("created_at", { ascending: false });
    if (error) { console.warn("[VETA_DB] discount_codes:", error.message); return; }
    _discountCodes = data || [];
  }

  async function init() {
    await Promise.all([loadProducts(), loadStock(), loadSettings(), loadDiscountCodes()]);
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

    // Suscripción en tiempo real — discount_codes
    sb.channel("discounts-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "discount_codes" }, async () => {
        await loadDiscountCodes();
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

  /* ── descuentos ── */
  function getDiscountCodes() { return _discountCodes; }

  // Devuelve el primer código activo con show_on_site=true (para el banner público)
  function getPublicPromoCode() {
    const now = new Date();
    return _discountCodes.find(d =>
      d.active &&
      d.show_on_site &&
      (!d.expires_at || new Date(d.expires_at) > now) &&
      (d.max_uses === null || d.uses_count < d.max_uses)
    ) || null;
  }

  async function validateCode(code, subtotal) {
    const upper = (code || "").toUpperCase().trim();
    const d = _discountCodes.find(c => c.code.toUpperCase() === upper && c.active);
    if (!d) return { valid: false, reason: "Código no válido o inactivo." };
    if (d.expires_at && new Date(d.expires_at) < new Date())
      return { valid: false, reason: "El código ha expirado." };
    if (d.max_uses !== null && d.uses_count >= d.max_uses)
      return { valid: false, reason: "Este código ya alcanzó su límite de usos." };
    if (d.min_subtotal > 0 && subtotal < d.min_subtotal) {
      const minFmt = window.VETA_DATA ? window.VETA_DATA.fmtPrice(d.min_subtotal) : "$" + Math.round(d.min_subtotal).toLocaleString("es-CO");
      return { valid: false, reason: `El subtotal mínimo para este código es ${minFmt}.` };
    }
    const discountAmount = d.type === "percent"
      ? Math.round(subtotal * d.value / 100)
      : Math.min(Number(d.value), subtotal);
    return { valid: true, code: upper, type: d.type, value: Number(d.value), discountAmount, description: d.description };
  }

  async function upsertDiscountCode(data) {
    const row = {
      code:         (data.code || "").toUpperCase().trim(),
      description:  data.description || "",
      type:         data.type || "percent",
      value:        Number(data.value),
      min_subtotal: Number(data.min_subtotal) || 0,
      max_uses:     data.max_uses ? Number(data.max_uses) : null,
      active:       data.active !== false,
      show_on_site: !!data.show_on_site,
      expires_at:   data.expires_at || null,
    };
    if (data.id) row.id = data.id;
    const { error } = await sb.from("discount_codes")
      .upsert(row, { onConflict: data.id ? "id" : "code" });
    if (error) throw error;
    await loadDiscountCodes();
    _notify();
  }

  async function deleteDiscountCode(id) {
    const { error } = await sb.from("discount_codes").delete().eq("id", id);
    if (error) throw error;
    _discountCodes = _discountCodes.filter(d => d.id !== id);
    _notify();
  }

  async function incrementCodeUses(code) {
    try {
      await sb.rpc("increment_discount_code_use", { p_code: (code || "").toUpperCase() });
      await loadDiscountCodes();
      _notify();
    } catch (e) { console.warn("[VETA_DB] incrementCodeUses:", e.message); }
  }

  /* ── despachos (wa_orders) ── */
  async function getOrders(status) {
    let q = sb.from("wa_orders").select("*").order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function updateOrderStatus(id, status) {
    const { error } = await sb.from("wa_orders").update({ status }).eq("id", id);
    if (error) throw error;
  }

  async function updateOrderNotes(id, admin_notes) {
    const { error } = await sb.from("wa_orders").update({ admin_notes }).eq("id", id);
    if (error) throw error;
  }

  async function deleteOrder(id) {
    const { error } = await sb.from("wa_orders").delete().eq("id", id);
    if (error) throw error;
  }

  async function updateOrderDeliveryNotes(id, delivery_notes) {
    const { error } = await sb.from("wa_orders").update({ delivery_notes }).eq("id", id);
    if (error) throw error;
  }

  async function toggleOrderHidden(id, hidden) {
    const { error } = await sb.from("wa_orders").update({ hidden }).eq("id", id);
    if (error) throw error;
  }

  /* ── buzón de WhatsApp (#admin → pestaña Chats) ──────────────
     Lectura de wa_conversations / wa_threads (requiere sesión admin;
     RLS authenticated). El envío de mensajes 'agent' va por un relay
     en n8n para no exponer el token de Meta en el navegador.        */

  // URL del webhook de n8n que envía por la Graph API y guarda el mensaje.
  const RELAY_URL = "https://n8n-production-e7c0.up.railway.app/webhook/veta-agent-send";

  let _threads = {};          // phone -> { phone, customer_name, bot_paused, needs_human, last_at }
  let _chatSubs = [];         // listeners de la pestaña Chats
  let _chatChannels = null;   // canales realtime (perezosos)

  function _notifyChats(payload) { _chatSubs.forEach(fn => { try { fn(payload); } catch {} }); }

  async function loadThreads() {
    const { data, error } = await sb.from("wa_threads").select("*");
    if (error) { console.warn("[VETA_DB] threads:", error.message); return _threads; }
    _threads = {};
    (data || []).forEach(t => { _threads[t.phone] = t; });
    return _threads;
  }
  function getThreads() { return _threads; }

  // Lista de conversaciones derivada de los últimos mensajes + estado del thread.
  async function getConversationList(limit = 1000) {
    const { data, error } = await sb.from("wa_conversations")
      .select("phone,role,content,created_at,msg_type")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) { console.warn("[VETA_DB] conv list:", error.message); return []; }
    const byPhone = {};
    (data || []).forEach(m => {
      if (!byPhone[m.phone]) byPhone[m.phone] = { phone: m.phone, last: m, count: 0 };
      byPhone[m.phone].count++;
    });
    return Object.values(byPhone)
      .map(c => ({ ...c, thread: _threads[c.phone] || null }))
      .sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
  }

  async function getMessages(phone) {
    const { data, error } = await sb.from("wa_conversations")
      .select("*").eq("phone", phone).order("created_at", { ascending: true });
    if (error) { console.warn("[VETA_DB] messages:", error.message); return []; }
    return data || [];
  }

  async function setBotPaused(phone, paused) {
    const { error } = await sb.from("wa_threads")
      .upsert({ phone, bot_paused: paused, updated_at: new Date().toISOString() }, { onConflict: "phone" });
    if (error) throw error;
    _threads[phone] = { ...(_threads[phone] || { phone }), bot_paused: paused };
    _notifyChats({ type: "thread", row: _threads[phone] });
  }

  async function clearNeedsHuman(phone) {
    const { error } = await sb.from("wa_threads")
      .upsert({ phone, needs_human: false, updated_at: new Date().toISOString() }, { onConflict: "phone" });
    if (error) throw error;
    _threads[phone] = { ...(_threads[phone] || { phone }), needs_human: false };
    _notifyChats({ type: "thread", row: _threads[phone] });
  }

  // Sube una imagen del asesor a Supabase Storage (bucket wa-media, lectura
  // pública) y devuelve su URL pública. El relay de n8n la reenvía a WhatsApp
  // como image.link (el token de Meta nunca llega al navegador).
  async function uploadChatImage(phone, file) {
    const session = await getSession();
    if (!session) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
    if (!file) throw new Error("No hay imagen para subir.");
    if (!/^image\//.test(file.type || "")) throw new Error("El archivo no es una imagen.");
    const ext = ((file.name || "").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `outbound/${phone}-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("wa-media")
      .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
    if (error) throw new Error("No se pudo subir la imagen: " + error.message);
    const { data } = sb.storage.from("wa-media").getPublicUrl(path);
    return data.publicUrl;
  }

  // Envía un mensaje como asesor humano vía el relay de n8n (valida el JWT).
  // `payload` puede ser un string (texto) o { text, type:'image', mediaUrl }.
  async function sendAgentMessage(phone, payload) {
    const body = typeof payload === "string" ? { text: payload } : (payload || {});
    const session = await getSession();
    const jwt = session?.access_token;
    if (!jwt) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
    const url = getSetting("agent_send_url", RELAY_URL);
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          message: body.text || "",
          type: body.type || "text",
          mediaUrl: body.mediaUrl || null,
          jwt,
        }),
      });
    } catch (e) { throw new Error("Sin conexión con el servidor de envío."); }
    if (!res.ok) {
      let msg = "No se pudo enviar (código " + res.status + ").";
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    return await res.json().catch(() => ({ ok: true }));
  }

  function _ensureChatChannels() {
    if (_chatChannels) return;
    const conv = sb.channel("wa-conv-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_conversations" },
        (p) => _notifyChats({ type: "message", row: p.new }))
      .subscribe();
    const thr = sb.channel("wa-threads-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_threads" }, (p) => {
        const row = p.new || p.old;
        if (row?.phone) {
          if (p.eventType === "DELETE") delete _threads[row.phone];
          else _threads[row.phone] = p.new;
        }
        _notifyChats({ type: "thread", row: p.new || null });
      })
      .subscribe();
    _chatChannels = [conv, thr];
  }
  function _teardownChatChannels() {
    if (!_chatChannels) return;
    _chatChannels.forEach(ch => { try { sb.removeChannel(ch); } catch {} });
    _chatChannels = null;
  }

  // Suscripción de la pestaña Chats: recibe {type:'message'|'thread', row}.
  // Crea los canales realtime al primer suscriptor y los cierra al último.
  function subscribeChats(fn) {
    _chatSubs.push(fn);
    _ensureChatChannels();
    return () => {
      _chatSubs = _chatSubs.filter(l => l !== fn);
      if (_chatSubs.length === 0) _teardownChatChannels();
    };
  }

  return {
    init, onReady, subscribe,
    getProducts, getStock, getSetting, isHidden,
    signIn, signOut, getSession, onAuthChange, changePassword,
    setStock, clearStock, setVisible, upsertProduct, deleteProduct, saveSetting,
    // descuentos
    getDiscountCodes, getPublicPromoCode, validateCode,
    upsertDiscountCode, deleteDiscountCode, incrementCodeUses,
    // buzón de chats
    loadThreads, getThreads, getConversationList, getMessages,
    setBotPaused, clearNeedsHuman, sendAgentMessage, uploadChatImage, subscribeChats,
    // despachos
    getOrders, updateOrderStatus, updateOrderNotes, deleteOrder,
    updateOrderDeliveryNotes, toggleOrderHidden,
    sb,
  };
})();
