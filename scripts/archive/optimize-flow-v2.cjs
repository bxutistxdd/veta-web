// 2ª pasada de optimización de tokens (sin perder funcionalidad):
//  - Preparar Contexto: trunca mensajes largos del historial a 500 chars + prompt más compacto.
//  - Groq: max_tokens 768 -> 512.
// Mantiene historial en 8 msgs (no bajar: se perdería el contexto del pedido en curso).
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'veta-whatsapp-flow.json');
const wf = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const byName = {}; wf.nodes.forEach(n => { byName[n.name] = n; });
const node = name => { const n = byName[name]; if (!n) throw new Error('no node: ' + name); return n; };

node('Preparar Contexto').parameters.jsCode =
`const msgData  = $('\\u00bfL\\u00edmite alcanzado?').first().json;
const isReset  = $('Parsear Mensaje WA').first().json.isReset === true;
const intent   = $('Detectar Intenci\\u00f3n').first().json;

// ── Historial (8 últimos, asc; cada mensaje truncado a 500 chars) ──
const HMAX = 500;
let historyArray = $('Historial de Conversaci\\u00f3n').all()
  .map(item => item.json)
  .filter(h => h && h.role && h.content)
  .reverse();
if (isReset) historyArray = [];
const esPrimerMensaje = historyArray.length === 0;

// ── Catálogo filtrado (compacto, sin blurb) ──
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

// ── Pedidos previos ──
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

// ── Saludo ──
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

const SYSTEM_PROMPT =
\`Eres Luna, asesora de ventas de VETA (joyer\\u00eda minimalista colombiana de autor) por WhatsApp.

\${saludoInstruccion}

IDENTIDAD: Te llamas Luna. Si preguntan: \"Soy Luna, asesora de VETA \\ud83c\\udf19\". No te repitas si ya hay historial.

TONO: C\\u00e1lida, cercana, espa\\u00f1ol colombiano (\"con gusto\", \"claro que s\\u00ed\"). 1-3 emojis, m\\u00e1x ~4 l\\u00edneas (salvo al mostrar productos). No presiones; cierra con un paso \\u00fatil.

FLUJO DE COMPRA (orden estricto):
1. Confirma pieza(s) y talla(s). Si no sabe la talla \\u2192 gu\\u00edala a \${siteUrl}#care.
2. Resumen: pieza, talla, acabado, precio.
3. Nombre completo.
4. Ciudad y direcci\\u00f3n (cualquier formato colombiano v\\u00e1lido).
5. Pago: transferencia/Nequi o contraentrega.
6. \\u00bfRegalo? Si s\\u00ed, nombre del destinatario.
7. Resumen completo \\u2192 \"\\u00bfConfirmas este pedido?\".
8. SOLO con confirmaci\\u00f3n expl\\u00edcita (s\\u00ed/confirmo/listo/ok/dale) generas el tag.

Al confirmar: escribe PRIMERO un mensaje c\\u00e1lido visible para el cliente; el tag va en l\\u00ednea aparte al final, nunca solo.

Obligatorios: nombre, ciudad, direcci\\u00f3n, pago. Opcionales (vac\\u00edos si no aplican): barrio, ref, destinatario, notes_cliente.
dir = calle+n\\u00famero o nombre del conjunto/portal. ref = apto/casa/piso/torre/porter\\u00eda. notes_cliente = instrucciones especiales. No insistas en calle+n\\u00famero si ya dio un lugar identificable.

Tag (EXACTO, al final):
[PEDIDO_CONFIRMADO: nombre=X | ciudad=X | items=PIEZA(talla)xCANT | pago=X | dir=X | barrio=X | ref=X | destinatario=X | notes_cliente=X]

ESCALA solo si el cliente lo pide, o hay queja/reclamo/problema con un pedido. Token interno [ESCALAR] (nunca lo menciones).

FAQ: Env\\u00edo 3-5 d\\u00edas h\\u00e1biles, solo Colombia. Pago: transferencia, Nequi, Daviplata o contraentrega. Materiales: plata 925, oro laminado 18k sobre plata 925, piercings acero quir\\u00fargico. Garant\\u00eda de por vida en la estructura. Tallas: \${siteUrl}#care.
\${pedidosResumen}
\${catalogSection}\`;

const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  ...historyArray.map(row => ({
    role: row.role === 'user' ? 'user' : 'assistant',
    content: (row.content || '').length > HMAX ? (row.content.slice(0, HMAX) + '\\u2026') : row.content
  })),
  { role: 'user', content: msgData.textContent }
];

return [{ json: {
  from:          msgData.from,
  phoneNumberId: msgData.phoneNumberId,
  userMessage:   msgData.textContent,
  messages,
  catalogMode:   intent.catalogMode,
} }];`;

// Groq: max_tokens 768 -> 512
const groq = node('Groq - Asesora VETA');
groq.parameters.jsonBody =
  '={"model":"llama-3.3-70b-versatile","max_tokens":512,"messages":{{ JSON.stringify($json.messages) }}}';

wf.versionId = 'groq-token-optimized-v2-' + Date.now();
fs.writeFileSync(FILE, JSON.stringify(wf, null, 2), 'utf8');
console.log('✓ 2ª pasada aplicada. versionId:', wf.versionId);
console.log('  - Historial: mensajes truncados a 500 chars (8 msgs)');
console.log('  - System prompt: más compacto (reglas y tag intactos)');
console.log('  - Groq max_tokens: 512');
