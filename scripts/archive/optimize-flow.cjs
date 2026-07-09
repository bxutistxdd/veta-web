// Optimiza veta-whatsapp-flow.json para ahorrar 60-70% de tokens de Groq.
// Transform LOCAL e idempotente sobre los nodos de la ruta de tokens.
// Cambios:
//  1. Detectar Intención  -> elimina fallback 'featured'; default = 'none'.
//  2. Cargar Catálogo     -> quita blurb del select; solo carga en category/product.
//  3. Historial           -> 20/30d  ->  8/7d.
//  4. Preparar Contexto   -> system prompt comprimido + catálogo compacto sin blurb.
//  5. Groq - Asesora VETA -> fix {{.GROQ_API_KEY}} -> {{$env.GROQ_API_KEY}}; max_tokens 1024->768.
//
// Ejecutar:  node optimize-flow.js
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'veta-whatsapp-flow.json');
const wf = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const byName = {};
wf.nodes.forEach(n => { byName[n.name] = n; });
function node(name) {
  const n = byName[name];
  if (!n) throw new Error('Nodo no encontrado: ' + name);
  return n;
}
function setHeader(n, headerName, value) {
  const params = n.parameters.headerParameters.parameters;
  const h = params.find(p => p.name === headerName);
  if (!h) throw new Error('Header no encontrado: ' + headerName + ' en ' + n.name);
  h.value = value;
}
function setQuery(n, queryName, value) {
  const params = n.parameters.queryParameters.parameters;
  const q = params.find(p => p.name === queryName);
  if (!q) throw new Error('Query no encontrado: ' + queryName + ' en ' + n.name);
  q.value = value;
}

// ── 1. Detectar Intención ─────────────────────────────────────────────
node('Detectar Intención').parameters.jsCode =
`const parsed = $('Parsear Mensaje WA').first().json;
const msg = (parsed.textContent || '').toLowerCase()
  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');

// Categorías de producto
const catMap = {
  anillos:   /\\banill[oa]s?\\b/,
  collares:  /\\bcollar(es)?\\b/,
  aretes:    /\\barete[s]?\\b|\\bzarcillo[s]?\\b|\\bpendiente[s]?\\b/,
  pulseras:  /\\bpulsera[s]?\\b|\\bbrazalete[s]?\\b/,
  piercings: /\\bpiercing[s]?\\b/,
};
const detectedCats = Object.entries(catMap)
  .filter(([, rx]) => rx.test(msg))
  .map(([cat]) => cat);

// ID de producto específico: an-01, co-03, ar-02, etc.
const productMatch = msg.match(/\\b(an|co|ar|pu|pi)-?0?\\d{1,2}\\b/i);
const productId = productMatch
  ? productMatch[0].replace(/^(an|co|ar|pu|pi)(\\d)/i, '$1-$2').toLowerCase()
  : null;

// El cliente quiere explorar / ver el catálogo -> le damos el LINK del sitio (0 tokens de productos)
const wantsCatalog = /catalogo|ver todo|todos los productos|que (tienen|tienes|manejan|venden|ofrecen|joyas|hay)|que mas|muestrame|ensename|recomi|opciones/.test(msg);

// MÁXIMO AHORRO: solo se inyecta catálogo real en category/product.
// full_catalog -> link.  Todo lo demás (FAQ, checkout, charla) -> none (0 tokens).
let catalogMode;
if (wantsCatalog)                  catalogMode = 'full_catalog';
else if (productId)                catalogMode = 'product';
else if (detectedCats.length > 0)  catalogMode = 'category';
else                               catalogMode = 'none';

return [{ json: { catalogMode, catFilter: detectedCats[0] || null, productId } }];`;

// ── 2. Cargar Catálogo ────────────────────────────────────────────────
node('Cargar Catálogo').parameters.url =
`={{
(() => {
  const base = $env.SUPABASE_URL + '/rest/v1/products';
  const mode = $('Detectar Intención').first().json.catalogMode;
  const cat  = $('Detectar Intención').first().json.catFilter;
  const pid  = $('Detectar Intención').first().json.productId;
  let p = 'visible=eq.true&select=id,name,cat,material,finish,price,sizes&order=cat';
  if (mode === 'category' && cat)     p += '&cat=eq.' + cat;
  else if (mode === 'product' && pid) p += '&id=eq.'  + pid;
  else                                p += '&limit=0';
  return base + '?' + p;
})()
}}`;

// ── 3. Historial de Conversación: 20/30d -> 8/7d ──────────────────────
setHeader(node('Historial de Conversación'), 'Range', '0-7');
setQuery(node('Historial de Conversación'), 'created_at',
  '=gte.{{ new Date(Date.now() - 7*24*60*60*1000).toISOString() }}');

// ── 4. Preparar Contexto: prompt comprimido + catálogo compacto ───────
node('Preparar Contexto').parameters.jsCode =
`const msgData  = $('\\u00bfL\\u00edmite alcanzado?').first().json;
const isReset  = $('Parsear Mensaje WA').first().json.isReset === true;
const intent   = $('Detectar Intenci\\u00f3n').first().json;

// ── Historial (8 últimos, asc) ───────────────────────────────
let historyArray = $('Historial de Conversaci\\u00f3n').all()
  .map(item => item.json)
  .filter(h => h && h.role && h.content)
  .reverse();
if (isReset) historyArray = [];
const esPrimerMensaje = historyArray.length === 0;

// ── Catálogo filtrado (compacto, sin blurb) ──────────────────
const products  = ($('Cargar Cat\\u00e1logo').first().json.body) || [];
const stockRows = ($('Cargar Stock').first().json.body) || [];
const stockMap  = {};
stockRows.forEach(r => { stockMap[r.product_id + '::' + r.size] = r.qty; });

const CAT_LABELS = { anillos:'ANILLOS', collares:'COLLARES', aretes:'ARETES', pulseras:'PULSERAS', piercings:'PIERCINGS' };
let siteUrl; try { siteUrl = $env.SITE_URL || 'vetajoyeria.co'; } catch(e) { siteUrl = 'vetajoyeria.co'; }

let catalogSection = '';
if (intent.catalogMode === 'full_catalog') {
  catalogSection = 'CAT\\u00c1LOGO: el cliente quiere explorar. Env\\u00edale el link ' + siteUrl +
    ' (cat\\u00e1logo con stock en tiempo real) y ofr\\u00e9cele orientarlo. No listes productos en el chat.';
} else if ((intent.catalogMode === 'category' || intent.catalogMode === 'product') && products.length > 0) {
  const byCat = {};
  products.forEach(p => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
  let catText = '';
  for (const cat of Object.keys(CAT_LABELS)) {
    const list = byCat[cat];
    if (!list || !list.length) continue;
    catText += '\\n' + CAT_LABELS[cat] + ':\\n';
    for (const p of list) {
      const precio = '$' + Number(p.price).toLocaleString('es-CO');
      const sizes  = Array.isArray(p.sizes) ? p.sizes : [];
      const dispo  = sizes.map(sz => {
        const q = stockMap[p.id + '::' + sz];
        return (q !== undefined && q <= 0) ? sz + '(agotada)' : sz;
      });
      const hayAlgo = sizes.length === 0 ||
        sizes.some(sz => { const q = stockMap[p.id + '::' + sz]; return q === undefined || q > 0; });
      const tallas = dispo.length ? dispo.join(',') : '\\u00fanica';
      catText += '\\u2022 ' + p.name + ' (' + p.id + ') ' + precio + ' \\u00b7 ' +
        p.material + ' ' + p.finish + ' \\u00b7 T:' + tallas + (hayAlgo ? '' : ' [AGOTADO]') + '\\n';
    }
  }
  if (catText) catalogSection = 'CAT\\u00c1LOGO (stock real):\\n' + catText +
    '\\nOfrece solo lo de arriba. \"(agotada)\"/[AGOTADO] \\u2192 no lo ofrezcas, prop\\u00f3n alternativa.';
}

// ── Pedidos previos ──────────────────────────────────────────
let pedidosRows = [];
try { pedidosRows = $('Cargar Pedidos Cliente').first().json.body || []; } catch(e) {}
let pedidosResumen = '';
if (!isReset && pedidosRows.length > 0) {
  pedidosResumen = '\\nPEDIDOS PREVIOS:\\n';
  const estados = { pending:'Pendiente', dispatched:'Despachado', delivered:'Entregado' };
  pedidosRows.forEach((p, i) => {
    const fecha = new Date(p.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short' });
    pedidosResumen += (i+1) + '. ' + p.items + ' | ' + p.city + ' | ' + (estados[p.status] || p.status) + ' | ' + fecha + '\\n';
  });
}

// ── Instrucción de saludo ────────────────────────────────────
let saludoInstruccion;
if (isReset) {
  saludoInstruccion = 'NUEVA SESI\\u00d3N: el cliente pidi\\u00f3 empezar de cero. (1) acusa recibo con calidez, (2) pres\\u00e9ntate: \"Soy Luna, asesora de VETA \\ud83c\\udf19\", (3) pregunta \"\\u00bfCon qui\\u00e9n tengo el gusto?\".';
} else if (esPrimerMensaje) {
  saludoInstruccion = 'PRIMER CONTACTO: saluda con calidez, pres\\u00e9ntate como \"Luna, asesora de VETA \\ud83c\\udf19\" y pregunta con qui\\u00e9n tienes el gusto.';
} else {
  saludoInstruccion = 'CLIENTE RECURRENTE: ' + (pedidosRows.length > 0
    ? 'tiene ' + pedidosRows.length + ' pedido(s) previo(s). Sal\\u00fadalo por nombre, sin presentarte. Ofrece: seguimiento al pedido reciente (' + pedidosRows[0].items + ', ' + pedidosRows[0].status + '), nuevo pedido, cat\\u00e1logo o dudas.'
    : 'sal\\u00fadalo por nombre, sin presentarte de nuevo.');
}

// ── System prompt (comprimido, mismas reglas) ────────────────
const SYSTEM_PROMPT =
\`Eres Luna, asesora de ventas de VETA (joyer\\u00eda minimalista colombiana de autor). Atiendes por WhatsApp.

\${saludoInstruccion}

IDENTIDAD: Te llamas Luna. Si preguntan, di \"Soy Luna, asesora de VETA \\ud83c\\udf19\". No te presentes de nuevo si ya hay historial.

TONO: C\\u00e1lida y cercana, espa\\u00f1ol colombiano (\"con gusto\", \"claro que s\\u00ed\"). 1-3 emojis. M\\u00e1x ~4 l\\u00edneas salvo al mostrar productos. Nunca presiones; cierra con un paso \\u00fatil.

FLUJO DE COMPRA (orden estricto):
1. Confirma pieza(s) y talla(s). Si no sabe la talla \\u2192 gu\\u00eda a \${siteUrl}#care.
2. Resumen: pieza, talla, acabado, precio.
3. Pide nombre completo.
4. Pide ciudad y direcci\\u00f3n (cualquier formato colombiano v\\u00e1lido).
5. Pago: transferencia/Nequi o contraentrega.
6. \\u00bfEs regalo? Si s\\u00ed, pide nombre del destinatario.
7. Resumen completo \\u2192 \"\\u00bfConfirmas este pedido?\".
8. SOLO con confirmaci\\u00f3n expl\\u00edcita (s\\u00ed/confirmo/listo/ok/dale) generas el tag.

CONFIRMACI\\u00d3N: al confirmar, escribe PRIMERO un mensaje c\\u00e1lido visible para el cliente; el tag va en l\\u00ednea aparte al final. Nunca el tag solo.

CAMPOS obligatorios: nombre, ciudad, direcci\\u00f3n, pago. Opcionales (vac\\u00edos si no aplican): barrio, ref, destinatario, notes_cliente.
dir = calle+n\\u00famero o nombre del conjunto/portal. ref = apto/casa/piso/torre/porter\\u00eda. notes_cliente = instrucciones especiales. No insistas en calle+n\\u00famero si ya dio un lugar identificable.

Tag (EXACTO, al final):
[PEDIDO_CONFIRMADO: nombre=X | ciudad=X | items=PIEZA(talla)xCANT | pago=X | dir=X | barrio=X | ref=X | destinatario=X | notes_cliente=X]

ESCALAMIENTO: escala SOLO si el cliente lo pide, o hay queja/reclamo/problema con un pedido. Token interno: [ESCALAR] (nunca lo menciones).

FAQ: Env\\u00edo 3-5 d\\u00edas h\\u00e1biles, solo Colombia. Pago: transferencia, Nequi, Daviplata o contraentrega. Materiales: plata 925, oro laminado 18k sobre plata 925, piercings acero quir\\u00fargico. Garant\\u00eda de por vida en la estructura. Tallas: \${siteUrl}#care.
\${pedidosResumen}
\${catalogSection}\`;

// ── Messages para Groq (formato OpenAI) ──────────────────────
const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  ...historyArray.map(row => ({ role: row.role === 'user' ? 'user' : 'assistant', content: row.content })),
  { role: 'user', content: msgData.textContent }
];

return [{ json: {
  from:          msgData.from,
  phoneNumberId: msgData.phoneNumberId,
  userMessage:   msgData.textContent,
  messages,
  catalogMode:   intent.catalogMode,
} }];`;

// ── 5. Groq - Asesora VETA: fix API key + max_tokens ──────────────────
const groq = node('Groq - Asesora VETA');
setHeader(groq, 'Authorization', '=Bearer {{$env.GROQ_API_KEY}}');
groq.parameters.jsonBody =
  '={"model":"llama-3.3-70b-versatile","max_tokens":768,"messages":{{ JSON.stringify($json.messages) }}}';

// ── versionId nuevo ───────────────────────────────────────────────────
wf.versionId = 'groq-token-optimized-' + Date.now();

fs.writeFileSync(FILE, JSON.stringify(wf, null, 2), 'utf8');

console.log('✓ Optimización aplicada. Nodos:', wf.nodes.length, '| versionId:', wf.versionId);
console.log('  1. Detectar Intención: fallback featured -> none');
console.log('  2. Cargar Catálogo: sin blurb, solo category/product');
console.log('  3. Historial: 8 msgs / 7 días');
console.log('  4. Preparar Contexto: prompt comprimido + catálogo compacto');
console.log('  5. Groq: fix GROQ_API_KEY + max_tokens 768');
