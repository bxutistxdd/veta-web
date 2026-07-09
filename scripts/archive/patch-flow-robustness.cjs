// Parchea veta-whatsapp-flow.json con mejoras de robustez del agente (C2 + C3).
// NO toca producción: solo reescribe el JSON del repo. Para desplegar:
//   node deploy-n8n-chat.js   →   railway redeploy --service n8n --yes
//
// C2: validación más estricta de los campos del pedido en "Procesar Respuesta"
//     (nombre/ciudad reales, método de pago conocido, dirección con largo mínimo)
//     + razón de rechazo para logging, para evitar pedidos basura.
// C3: reintentos automáticos (retryOnFail) en las llamadas frágiles a Groq y a
//     Meta Graph API (la red/LLM fallan de forma transitoria).
//
// Ejecutar:  node patch-flow-robustness.js
const fs = require('fs');
const path = __dirname + '/veta-whatsapp-flow.json';
const wf = JSON.parse(fs.readFileSync(path, 'utf8'));

const byName = name => wf.nodes.find(n => n.name === name);
let changes = [];

// ── C2 · Endurecer validación del pedido ────────────────────────────────────
const procesar = byName('Procesar Respuesta');
if (!procesar) throw new Error('No se encontró el nodo "Procesar Respuesta"');

const NEW_PROCESAR = `const geminiResponse = $input.first().json;
const contextData    = $('Preparar Contexto').first().json;

const assistantMessage = geminiResponse.choices?.[0]?.message?.content
  || 'Hubo un error procesando tu mensaje. Int\\u00e9ntalo de nuevo.';

const needsHuman = /\\[ESCALAR\\]/i.test(assistantMessage);

const orderMatch =
  assistantMessage.match(/\\[?PEDIDO_CONFIRMADO:\\s*([^\\]\\n]+?)\\]?(?=\\s*$|\\n)/m) ||
  assistantMessage.match(/\\[?PEDIDO_CONFIRMADO:\\s*([^\\]]+?)\\]?/);

let orderData = null;
let orderRejected = null;   // razón de rechazo (para log), si el tag vino mal
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
  const nombre = (parts['nombre'] || '').trim();
  const ciudad = (parts['ciudad'] || '').trim();
  const items  = (parts['items']  || '').trim();
  const pago   = (parts['pago']   || '').trim();
  const dir    = (parts['dir']    || '').trim();

  // Validación estricta: campos reales, no marcadores ni basura del LLM.
  const PAGO_RE  = /(transfer|nequi|daviplata|contra\\s*entrega|contraentrega|efectivo|consignaci)/i;
  const LETRA_RE = /[a-záéíóúñ]/i;
  const checks = {
    nombre: nombre.length >= 3 && LETRA_RE.test(nombre),
    ciudad: ciudad.length >= 3 && LETRA_RE.test(ciudad),
    items:  items.length  >= 3,
    pago:   PAGO_RE.test(pago),
    dir:    dir.length    >= 5,
  };
  const fallidos = Object.keys(checks).filter(k => !checks[k]);

  if (fallidos.length === 0) {
    parts['notas'] = 'Pago: ' + pago + '. Dir: ' + dir +
      (parts['barrio'] ? '. Barrio: ' + parts['barrio'] : '') +
      (parts['ref']    ? '. Ref: '    + parts['ref']    : '');
    parts['client_notes'] = parts['notes_cliente'] || '';
    orderData = parts;
  } else {
    orderRejected = 'Campos inválidos: ' + fallidos.join(', ');
    console.warn('[VETA] PEDIDO_CONFIRMADO descartado →', orderRejected, '| crudo:', orderMatch[1]);
  }
}

return [{ json: {
  from:             contextData.from,
  phoneNumberId:    contextData.phoneNumberId,
  userMessage:      contextData.userMessage,
  assistantMessage: cleanMessage,
  hasOrder:         !!orderData,
  orderData,
  orderRejected,
  needsHuman,
} }];`;

if (procesar.parameters.jsCode !== NEW_PROCESAR) {
  procesar.parameters.jsCode = NEW_PROCESAR;
  changes.push('C2: validación de pedido endurecida en "Procesar Respuesta"');
}

// ── C3 · Reintentos en llamadas frágiles ────────────────────────────────────
const RETRY = { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000 };
for (const name of ['Groq - Asesora VETA', 'Enviar Respuesta por WA']) {
  const node = byName(name);
  if (!node) { console.warn('  (aviso) no se encontró', name); continue; }
  let touched = false;
  for (const [k, v] of Object.entries(RETRY)) {
    if (node[k] !== v) { node[k] = v; touched = true; }
  }
  if (touched) changes.push('C3: reintentos (maxTries 3) en "' + name + '"');
}

// ── Guardar ──────────────────────────────────────────────────────────────────
if (!changes.length) {
  console.log('Sin cambios: el flujo ya tenía las mejoras aplicadas.');
} else {
  fs.writeFileSync(path, JSON.stringify(wf, null, 2) + '\n', 'utf8');
  console.log('Flujo parcheado (' + wf.nodes.length + ' nodos). Cambios:');
  changes.forEach(c => console.log('  ✓ ' + c));
  console.log('\nDespliegue (cuando haya luz verde):');
  console.log('  node deploy-n8n-chat.js  &&  railway redeploy --service n8n --yes');
}
