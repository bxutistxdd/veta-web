/**
 * transform-to-gemini.js
 * Migra el flujo de n8n de Groq (chat) a Gemini 1.5 Flash y agrega
 * detección de intención para carga eficiente del catálogo.
 *
 * Cambios:
 *  1. Nuevo nodo "Detectar Intención" (keyword matching, sin IA)
 *  2. "Cargar Catálogo" — URL dinámica filtrada por intención
 *  3. "Preparar Contexto" — catálogo inteligente + formato Gemini
 *  4. "Groq - Asesora VETA" → "Gemini - Asesora VETA"
 *  5. "Procesar Respuesta" — lee formato de respuesta Gemini
 */

const fs   = require('fs');
const path = require('path');

const flowPath = path.join(__dirname, 'veta-whatsapp-flow.json');
const flow     = JSON.parse(fs.readFileSync(flowPath, 'utf8'));

const find    = name => flow.nodes.find(n => n.name === name);
const findIdx = name => flow.nodes.findIndex(n => n.name === name);

// ═══════════════════════════════════════════════════════════════
// 1. NUEVO NODO: Detectar Intención
// ═══════════════════════════════════════════════════════════════
const DETECTAR_CODE = `
const parsed = $('Parsear Mensaje WA').first().json;
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

// Cliente pide ver el catálogo completo
const wantsCatalog = /cat[a\\u00e1]logo|ver todo|todos los productos|qu[e\\u00e9] (tienen|tienes|manejan|venden|ofrecen|joyas)|qu[e\\u00e9] (hay|tienen)/.test(msg);

// FAQ pura — no necesita catálogo
const isFaq = detectedCats.length === 0 && !productId && !wantsCatalog && (
  /env[i\\u00ed]o|despacho|tarifa|costo.*env|cu[a\\u00e1]nto tarda|d[o\\u00f3]nde env|internacional/.test(msg) ||
  /talla|medida|aro|circunferencia|gu[i\\u00ed]a.*talla/.test(msg) ||
  /material|plata|oro|acero|qu[i\\u00ed]rurgico|alerg/.test(msg) ||
  /garant[i\\u00ed]a|cuidado|mantenimiento/.test(msg) ||
  /pago|nequi|daviplata|transferencia|contraentrega|efectivo|bancolombia/.test(msg)
);

let catalogMode;
if (wantsCatalog)                  catalogMode = 'full_catalog';
else if (productId)                catalogMode = 'product';
else if (detectedCats.length > 0)  catalogMode = 'category';
else if (isFaq)                    catalogMode = 'none';
else                               catalogMode = 'featured';

return [{ json: {
  catalogMode,
  catFilter: detectedCats[0] || null,
  productId,
} }];
`.trim();

if (!find('Detectar Intención')) {
  flow.nodes.push({
    id:          'detectar-intencion-v1',
    name:        'Detectar Intención',
    type:        'n8n-nodes-base.code',
    typeVersion: 2,
    position:    [3600, 760],
    parameters:  { jsCode: DETECTAR_CODE },
  });
  console.log('+ Nodo agregado: Detectar Intención');
}

// ═══════════════════════════════════════════════════════════════
// 2. MODIFICAR: Cargar Catálogo — URL dinámica
// ═══════════════════════════════════════════════════════════════
const cargarCatalogo = find('Cargar Catálogo');
if (cargarCatalogo) {
  cargarCatalogo.parameters = {
    url: `={{
(() => {
  const base = $env.SUPABASE_URL + '/rest/v1/products';
  const mode = $('Detectar Intención').first().json.catalogMode;
  const cat  = $('Detectar Intención').first().json.catFilter;
  const pid  = $('Detectar Intención').first().json.productId;
  let p = 'visible=eq.true&select=id,name,cat,material,finish,price,sizes,blurb&order=cat';
  if (mode === 'none' || mode === 'full_catalog') p += '&limit=0';
  else if (mode === 'category' && cat)            p += '&cat=eq.' + cat;
  else if (mode === 'product'  && pid)            p += '&id=eq.'  + pid;
  else if (mode === 'featured')                   p += '&limit=8';
  return base + '?' + p;
})()
}}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'apikey',        value: '={{$env.SUPABASE_SERVICE_KEY}}' },
        { name: 'Authorization', value: '=Bearer {{$env.SUPABASE_SERVICE_KEY}}' },
      ],
    },
    options: { response: { response: { fullResponse: true } } },
  };
  console.log('✓ Modificado: Cargar Catálogo (URL dinámica por intención)');
}

// ═══════════════════════════════════════════════════════════════
// 3. MODIFICAR: Preparar Contexto — catálogo inteligente + Gemini
// ═══════════════════════════════════════════════════════════════
const PREPARAR_CODE = `
const msgData  = $('\\u00bfL\\u00edmite alcanzado?').first().json;
const isReset  = $('Parsear Mensaje WA').first().json.isReset === true;
const intent   = $('Detectar Intenci\\u00f3n').first().json;

// ── Historial ────────────────────────────────────────────────
let historyArray = $('Historial de Conversaci\\u00f3n').all()
  .map(item => item.json)
  .filter(h => h && h.role && h.content)
  .reverse();  // Supabase devuelve desc, necesitamos asc
if (isReset) historyArray = [];
const esPrimerMensaje = historyArray.length === 0;

// ── Catálogo filtrado ────────────────────────────────────────
const products  = ($('Cargar Cat\\u00e1logo').first().json.body) || [];
const stockRows = ($('Cargar Stock').first().json.body) || [];
const stockMap  = {};
stockRows.forEach(r => { stockMap[r.product_id + '::' + r.size] = r.qty; });

const CAT_LABELS = {
  anillos:'ANILLOS', collares:'COLLARES', aretes:'ARETES',
  pulseras:'PULSERAS', piercings:'PIERCINGS'
};

let siteUrl; try { siteUrl = $env.SITE_URL || 'vetajoyeria.co'; } catch(e) { siteUrl = 'vetajoyeria.co'; }

let catalogSection = '';
if (intent.catalogMode === 'full_catalog') {
  catalogSection = 'CAT\\u00c1LOGO: El cliente quiere ver el cat\\u00e1logo completo. ' +
    'Resp\\u00f3ndele envi\\u00e1ndole el link del sitio: ' + siteUrl +
    ' \\u2014 ah\\u00ed puede explorar todo con stock en tiempo real. No listes productos en el chat.';
} else if (intent.catalogMode !== 'none' && products.length > 0) {
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
        return (q !== undefined && q <= 0) ? sz + ' (agotada)' : sz;
      });
      const hayAlgo = sizes.length === 0 ||
        sizes.some(sz => { const q = stockMap[p.id + '::' + sz]; return q === undefined || q > 0; });
      const tallas = dispo.length ? dispo.join(', ') : '\\u00fanica';
      catText += '\\u2022 ' + p.name + ' (' + p.id + ') | ' + p.material + ' | ' +
        p.finish + ' | ' + precio + ' | Tallas: ' + tallas +
        (hayAlgo ? '' : ' \\u2014 AGOTADA') + '\\n';
      if (p.blurb) catText += '  ' + p.blurb + '\\n';
    }
  }
  if (catText) {
    catalogSection = 'CAT\\u00c1LOGO DISPONIBLE (stock real):\\n' + catText +
      '\\nSolo ofrece lo que aparece arriba. Talla "(agotada)" o "AGOTADA" \\u2192 no la ofrezcas, prop\\u00f3n alternativa.';
  }
}

// ── Pedidos previos ──────────────────────────────────────────
let pedidosRows = [];
try { pedidosRows = $('Cargar Pedidos Cliente').first().json.body || []; } catch(e) {}
let pedidosResumen = '';
if (!isReset && pedidosRows.length > 0) {
  pedidosResumen = '\\nPEDIDOS PREVIOS DEL CLIENTE:\\n';
  const estados = { pending:'Pendiente \\u23f3', dispatched:'Despachado \\ud83d\\ude9a', delivered:'Entregado \\u2705' };
  pedidosRows.forEach((p, i) => {
    const fecha = new Date(p.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short' });
    const est   = estados[p.status] || p.status;
    pedidosResumen += (i+1) + '. ' + p.items + ' | ' + p.city + ' | ' + est + ' | ' + fecha + '\\n';
    if (p.notes) pedidosResumen += '   ' + p.notes + '\\n';
  });
}

// ── Instrucción de saludo ────────────────────────────────────
let saludoInstruccion;
if (isReset) {
  saludoInstruccion = 'NUEVA SESI\\u00d3N: el cliente pidi\\u00f3 iniciar desde cero. Debes: (1) acusar recibo con calidez, (2) presentarte EXPL\\u00cdCITAMENTE: "Soy Luna, asesora de VETA \\ud83c\\udf19", (3) preguntar "\\u00bfCon qui\\u00e9n tengo el gusto?"';
} else if (esPrimerMensaje) {
  saludoInstruccion = 'PRIMER CONTACTO: saluda con calidez. Pres\\u00e9ntate EXPL\\u00cdCITAMENTE como "Luna, asesora de VETA \\ud83c\\udf19" y pregunta con qui\\u00e9n tienes el gusto.';
} else {
  saludoInstruccion = 'CLIENTE RECURRENTE: ' + (pedidosRows.length > 0
    ? 'tiene ' + pedidosRows.length + ' pedido(s) previo(s). Sal\\u00fadalo por nombre, sin presentarte de nuevo. Ofrece naturalmente: seguimiento al pedido m\\u00e1s reciente (' + pedidosRows[0].items + ', ' + pedidosRows[0].status + '), nuevo pedido, cat\\u00e1logo o dudas.'
    : 'sin pedidos previos. Sal\\u00fadalo por nombre, sin presentarte de nuevo.');
}

// ── System prompt ────────────────────────────────────────────
const SYSTEM_PROMPT =
\`Eres Luna, asesora de ventas de VETA, marca colombiana de joyer\\u00eda minimalista de autor. Atiendes por WhatsApp.

\${saludoInstruccion}

IDENTIDAD:
- Tu nombre es Luna. Si preguntan c\\u00f3mo te llamas: "Soy Luna, asesora de VETA \\ud83c\\udf19".
- NO te vuelvas a presentar si ya hay historial activo.

TONO:
- C\\u00e1lida, cercana, como asesora de boutique que de verdad quiere ayudar.
- Espa\\u00f1ol colombiano: "con gusto", "claro que s\\u00ed", "quedo pendiente".
- Emojis con gracia: 1-3 por mensaje. M\\u00e1x ~4 l\\u00edneas salvo al mostrar productos.
- Nunca presiones. Cierra siempre con un paso \\u00fatil o pregunta que avance.

FLUJO DE COMPRA (sigue este orden ESTRICTAMENTE):
1. Confirma pieza(s) y talla(s).
2. Si no sabe la talla \\u2192 gu\\u00eda a \${siteUrl}#care antes de continuar.
3. Resumen claro: pieza, talla, acabado, precio.
4. Pide nombre completo.
5. Pide ciudad y direcci\\u00f3n (acepta CUALQUIER formato colombiano v\\u00e1lido).
6. M\\u00e9todo de pago: transferencia/Nequi o contraentrega.
7. \\u00bfEs regalo? Si s\\u00ed, pide nombre del destinatario.
8. Resumen completo \\u2192 "\\u00bfConfirmas este pedido?"
9. SOLO con confirmaci\\u00f3n expl\\u00edcita (s\\u00ed/confirmo/listo/ok/dale) genera el tag.

REGLA CR\\u00cdTICA \\u2014 CONFIRMACI\\u00d3N: cuando confirmes un pedido escribe PRIMERO un mensaje c\\u00e1lido visible para el cliente. El tag va en l\\u00ednea aparte al final. Nunca el tag solo.

CAMPOS OBLIGATORIOS: nombre completo, ciudad, direcci\\u00f3n, m\\u00e9todo de pago.
CAMPOS OPCIONALES (incl\\u00fayellos vac\\u00edos si no aplican): barrio, ref, destinatario, notes_cliente.

REGLA dir vs ref:
- dir = direcci\\u00f3n base (calle+n\\u00famero O nombre del conjunto/portal/urbanizaci\\u00f3n).
- ref = complemento (apto, casa, piso, torre, porter\\u00eda, recepci\\u00f3n).
- notes_cliente = instrucciones especiales.
- NO insistas en calle+n\\u00famero si el cliente ya di\\u00f3 un lugar identificable.

Tag (EXACTAMENTE con corchetes, al final):
[PEDIDO_CONFIRMADO: nombre=X | ciudad=X | items=PIEZA(talla)xCANT | pago=X | dir=X | barrio=X | ref=X | destinatario=X | notes_cliente=X]

ESCALAMIENTO: escala SOLO si el cliente lo pide expl\\u00edcitamente, hay queja/reclamo/molestia o problema con pedido existente. Token interno: [ESCALAR] (nunca lo menciones).

PREGUNTAS FRECUENTES:
- Env\\u00edo: 3-5 d\\u00edas h\\u00e1biles, solo Colombia.
- Pago: transferencia, Nequi, Daviplata o contraentrega.
- Materiales: plata 925, oro laminado 18k sobre plata 925, piercings acero quir\\u00fargico.
- Garant\\u00eda: de por vida en la estructura de cada pieza.
- Tallas: gu\\u00eda en \${siteUrl}#care.
\${pedidosResumen}
\${catalogSection}\`;

// ── Construir contents para Gemini ───────────────────────────
// Gemini exige: alternancia user/model, empieza y termina en user.
const sanitized = [];
for (const row of historyArray) {
  const role = row.role === 'user' ? 'user' : 'model';
  if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === role) continue;
  sanitized.push({ role, content: row.content });
}
// Nunca puede empezar con 'model'
while (sanitized.length > 0 && sanitized[0].role === 'model') sanitized.shift();

const contents = [
  ...sanitized.map(r => ({ role: r.role, parts: [{ text: r.content }] })),
  { role: 'user', parts: [{ text: msgData.textContent }] },
];

const geminiRequest = {
  system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
  contents,
  generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
};

return [{ json: {
  from:          msgData.from,
  phoneNumberId: msgData.phoneNumberId,
  userMessage:   msgData.textContent,
  geminiRequest,
  catalogMode:   intent.catalogMode,
} }];
`.trim();

const preparar = find('Preparar Contexto');
if (preparar) {
  preparar.parameters.jsCode = PREPARAR_CODE;
  console.log('✓ Modificado: Preparar Contexto (intent + formato Gemini)');
}

// ═══════════════════════════════════════════════════════════════
// 4. REEMPLAZAR: Groq (chat) → Gemini 1.5 Flash
// ═══════════════════════════════════════════════════════════════
const groqNode = find('Groq - Asesora VETA');
if (groqNode) {
  groqNode.name = 'Gemini - Asesora VETA';
  groqNode.parameters = {
    method: 'POST',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'x-goog-api-key', value: '={{$env.GEMINI_API_KEY}}' },
        { name: 'Content-Type',   value: 'application/json' },
      ],
    },
    sendBody:     true,
    specifyBody:  'json',
    jsonBody:     '={{ JSON.stringify($json.geminiRequest) }}',
    options:      {},
  };
  console.log('✓ Reemplazado: Groq - Asesora VETA → Gemini - Asesora VETA');

  // Renombrar clave en connections
  if (flow.connections['Groq - Asesora VETA']) {
    flow.connections['Gemini - Asesora VETA'] = flow.connections['Groq - Asesora VETA'];
    delete flow.connections['Groq - Asesora VETA'];
  }
  // Actualizar referencias en conexiones entrantes
  Object.values(flow.connections).forEach(c => {
    c.main?.forEach(outputs => outputs.forEach(conn => {
      if (conn.node === 'Groq - Asesora VETA') conn.node = 'Gemini - Asesora VETA';
    }));
  });
  console.log('✓ Conexiones actualizadas: Groq → Gemini');
}

// ═══════════════════════════════════════════════════════════════
// 5. MODIFICAR: Procesar Respuesta — formato respuesta Gemini
// ═══════════════════════════════════════════════════════════════
const PROCESAR_CODE = `
const geminiResponse = $input.first().json;
const contextData    = $('Preparar Contexto').first().json;

// Gemini: candidates[0].content.parts[0].text
const assistantMessage = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text
  || 'Hubo un error procesando tu mensaje. Int\\u00e9ntalo de nuevo.';

const needsHuman = /\\[ESCALAR\\]/i.test(assistantMessage);

const orderMatch =
  assistantMessage.match(/\\[?PEDIDO_CONFIRMADO:\\s*([^\\]\\n]+?)\\]?(?=\\s*$|\\n)/m) ||
  assistantMessage.match(/\\[?PEDIDO_CONFIRMADO:\\s*([^\\]]+?)\\]?/);

let orderData = null;
let cleanMessage = assistantMessage
  .replace(/\\[?PEDIDO_CONFIRMADO:[^\\]\\n]*\\]?/g, '')
  .replace(/\\[ESCALAR\\]/ig, '')
  .trim();

if (orderMatch) {
  const parts = {};
  orderMatch[1].split('|').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > 0) parts[p.slice(0, idx).trim()] = p.slice(idx + 1).trim();
  });
  // Compatibilidad formato antiguo
  if (!parts['pago'] && parts['notas']) {
    const m = (parts['notas'] || '').match(/pago:\\s*([^.]+)/i);
    if (m) parts['pago'] = m[1].trim();
  }
  if (!parts['dir'] && parts['notas']) {
    const dIdx = (parts['notas'] || '').search(/dir:/i);
    if (dIdx >= 0) parts['dir'] = parts['notas'].slice(dIdx + 4).trim();
  }
  const { nombre='', ciudad='', items='', pago='', dir='' } = parts;
  if (nombre.length > 1 && ciudad.length > 1 && items.length > 1 && pago.length > 1 && dir.length > 3) {
    parts['notas'] = 'Pago: ' + pago + '. Dir: ' + dir +
      (parts['barrio'] ? '. Barrio: ' + parts['barrio'] : '') +
      (parts['ref']    ? '. Ref: '    + parts['ref']    : '');
    parts['client_notes'] = parts['notes_cliente'] || '';
    orderData = parts;
  }
}

return [{ json: {
  from:             contextData.from,
  phoneNumberId:    contextData.phoneNumberId,
  userMessage:      contextData.userMessage,
  assistantMessage: cleanMessage,
  hasOrder:         !!orderData,
  orderData,
  needsHuman,
} }];
`.trim();

const procesar = find('Procesar Respuesta');
if (procesar) {
  procesar.parameters.jsCode = PROCESAR_CODE;
  console.log('✓ Modificado: Procesar Respuesta (formato Gemini)');
}

// ═══════════════════════════════════════════════════════════════
// 6. CONEXIONES — insertar Detectar Intención entre ¿Bot en pausa? y Cargar Catálogo
// ═══════════════════════════════════════════════════════════════
const pauseConns = flow.connections['¿Bot en pausa?'];
if (pauseConns?.main?.[1]) {
  const idx = pauseConns.main[1].findIndex(c => c.node === 'Cargar Catálogo');
  if (idx !== -1) {
    pauseConns.main[1][idx].node = 'Detectar Intención';
    console.log('✓ Reconectado: ¿Bot en pausa? output[1] → Detectar Intención');
  }
}
if (!flow.connections['Detectar Intención']) {
  flow.connections['Detectar Intención'] = {
    main: [[{ node: 'Cargar Catálogo', type: 'main', index: 0 }]],
  };
  console.log('✓ Conexión agregada: Detectar Intención → Cargar Catálogo');
}

// ═══════════════════════════════════════════════════════════════
// 7. versionId
// ═══════════════════════════════════════════════════════════════
flow.versionId = 'gemini-v1-' + Date.now();

// ═══════════════════════════════════════════════════════════════
// GUARDAR
// ═══════════════════════════════════════════════════════════════
fs.writeFileSync(flowPath, JSON.stringify(flow, null, 2));
console.log('\n✅ veta-whatsapp-flow.json actualizado');
console.log('\nSIGUIENTES PASOS:');
console.log('  1. Agregar GEMINI_API_KEY en Railway (Variables del servicio n8n)');
console.log('  2. node deploy-workflow-fixes.js');
console.log('  3. railway redeploy --service n8n --yes');
