// B1 · Valida la firma X-Hub-Signature-256 del webhook de Meta.
// Inserta un nodo "Validar Firma Meta" entre el Webhook y "Responder 200 OK",
// y activa rawBody en el webhook. Patrón FAIL-OPEN: por defecto (WA_SIG_ENFORCE
// != 'true') solo registra en logs; no bloquea. Tras confirmar que las firmas
// reales validan, se pone WA_SIG_ENFORCE=true y "Parsear Mensaje WA" descarta
// los mensajes sin firma válida.
//
// Requiere en el env de n8n: APP_SECRET, NODE_FUNCTION_ALLOW_BUILTIN=crypto,
// y (opcional) WA_SIG_ENFORCE. NO toca producción: solo reescribe el JSON.
//   node patch-flow-b1.js  →  node deploy-n8n-chat.js  →  railway redeploy
const fs = require('fs');
const path = __dirname + '/veta-whatsapp-flow.json';
const wf = JSON.parse(fs.readFileSync(path, 'utf8'));

const WEBHOOK = 'Webhook - Mensajes WhatsApp';
const RESP    = 'Responder 200 OK a Meta';
const VALIDAR = 'Validar Firma Meta';
const PARSEAR = 'Parsear Mensaje WA';

const byName = n => wf.nodes.find(x => x.name === n);
const changes = [];

// 1) rawBody en el webhook (para reconstruir el cuerpo exacto que firmó Meta)
const wh = byName(WEBHOOK);
if (!wh) throw new Error('No se encontró el webhook ' + WEBHOOK);
wh.parameters.options = wh.parameters.options || {};
if (wh.parameters.options.rawBody !== true) {
  wh.parameters.options.rawBody = true;
  changes.push('rawBody=true en el webhook');
}

// 2) Nodo Validar Firma Meta
const VALIDAR_CODE = `const item = $input.first().json;
const bin  = $input.first().binary;
const crypto = require('crypto');

let secret = '';
try { secret = $env.APP_SECRET || ''; } catch (e) {}
let enforce = false;
try { enforce = String($env.WA_SIG_ENFORCE || '').toLowerCase() === 'true'; } catch (e) {}

// Cuerpo crudo exacto que firmó Meta (binary 'data' o item.rawBody)
let raw = '';
if (bin && bin.data && bin.data.data) {
  raw = Buffer.from(bin.data.data, 'base64').toString('utf8');
} else if (typeof item.rawBody === 'string') {
  raw = item.rawBody;
}

let body = item.body;
if (raw) { try { body = JSON.parse(raw); } catch (e) {} }

const headers   = item.headers || {};
const sigHeader = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'] || '';

let sigValid = false;
if (secret && raw && sigHeader.indexOf('sha256=') === 0) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sigHeader);
    sigValid = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { sigValid = false; }
}

if (sigValid) {
  console.log('[VETA][B1] Firma válida ✓');
} else {
  console.warn('[VETA][B1] Firma inválida/ausente. enforce=' + enforce +
    ' header=' + (sigHeader ? 'sí' : 'no') + ' raw=' + (raw ? raw.length + 'b' : 'no') +
    ' secret=' + (secret ? 'sí' : 'no'));
}

return [{ json: Object.assign({}, item, { body: body, __sigValid: sigValid, __sigEnforce: enforce }) }];`;

let validar = byName(VALIDAR);
if (!validar) {
  validar = {
    parameters: { jsCode: VALIDAR_CODE },
    id: 'b1516a7u-0000-0000-0000-000000000001',
    name: VALIDAR,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [120, 80],
  };
  wf.nodes.push(validar);
  changes.push('nodo "' + VALIDAR + '" insertado');
} else {
  validar.parameters.jsCode = VALIDAR_CODE;
  changes.push('nodo "' + VALIDAR + '" actualizado');
}

// 3) Reconectar: Webhook → Validar → Responder 200 → (resto igual)
const c = wf.connections;
const whTargets = c[WEBHOOK] && c[WEBHOOK].main && c[WEBHOOK].main[0] || [];
const goesToResp = whTargets.some(t => t.node === RESP);
if (goesToResp) {
  c[WEBHOOK].main[0] = [{ node: VALIDAR, type: 'main', index: 0 }];
  c[VALIDAR] = { main: [[{ node: RESP, type: 'main', index: 0 }]] };
  changes.push('reconexión Webhook → Validar → Responder 200');
}

// 4) Enforcement en "Parsear Mensaje WA" (descarta si enforce y firma inválida)
const parsear = byName(PARSEAR);
if (!parsear) throw new Error('No se encontró ' + PARSEAR);
const GUARD = "const __wa = $input.first().json;\nif (__wa.__sigEnforce === true && __wa.__sigValid !== true) { return [{ json: { skip: true } }]; }\n";
if (!parsear.parameters.jsCode.startsWith('const __wa =')) {
  parsear.parameters.jsCode = GUARD + parsear.parameters.jsCode;
  changes.push('guard de firma en "' + PARSEAR + '"');
}

if (!changes.length) {
  console.log('Sin cambios: B1 ya estaba aplicado.');
} else {
  fs.writeFileSync(path, JSON.stringify(wf, null, 2) + '\n', 'utf8');
  console.log('B1 aplicado (' + wf.nodes.length + ' nodos):');
  changes.forEach(x => console.log('  ✓ ' + x));
}
