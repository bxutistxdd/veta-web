// patch-flow-cart-quote.js
// Agrega al flujo n8n la carga temprana de cart_quotes cuando el cliente
// llega desde el carrito web (mensaje "Pedido #CODE").
//
// Problema: cart_quotes se consultaba solo al CONFIRMAR el pedido.
// Luna no sabía el total ni el descuento hasta el final del flujo.
// Solución: nuevo nodo "Cargar Cotización (Entrante)" entre
// "Historial de Conversación" → "Preparar Contexto", que carga los
// datos del carrito al inicio. Luna los recibe en su system prompt
// y puede responder inmediatamente con el total y el descuento.
//
// Ejecutar: node patch-flow-cart-quote.js

const fs = require('fs');
const path = __dirname + '/veta-whatsapp-flow.json';
const wf = JSON.parse(fs.readFileSync(path, 'utf8'));

const byName = name => wf.nodes.find(n => n.name === name);
let changes = [];

// ── 1. Agregar nodo "Cargar Cotización (Entrante)" ──────────────────────────
const NUEVO_ID = 'cart-quote-entrante-001';
const existe = wf.nodes.find(n => n.id === NUEVO_ID);
if (!existe) {
  wf.nodes.push({
    id: NUEVO_ID,
    name: 'Cargar Cotización (Entrante)',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [3120, 260],
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: {
      url: "={{$env.SUPABASE_URL}}/rest/v1/cart_quotes?code=eq.{{ $('Parsear Mensaje WA').first().json.quoteCode || '____NOOP____' }}&select=code,items,subtotal,discount_code,discount_amount,total",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'apikey', value: '={{$env.SUPABASE_SERVICE_KEY}}' },
          { name: 'Authorization', value: '=Bearer {{$env.SUPABASE_SERVICE_KEY}}' }
        ]
      },
      options: {
        response: { response: { fullResponse: true } }
      }
    }
  });
  changes.push('Nuevo nodo "Cargar Cotización (Entrante)" agregado');
}

// ── 2. Reconectar: Historial de Conversación → nuevo nodo → Preparar Contexto ─
const conns = wf.connections;

// Cambiar "Historial de Conversación" → "Preparar Contexto"
//                                     → "Cargar Cotización (Entrante)"
if (conns['Historial de Conversación']) {
  const mains = conns['Historial de Conversación'].main || [];
  if (mains[0]) {
    const yaConectado = mains[0].some(c => c.node === 'Cargar Cotización (Entrante)');
    if (!yaConectado) {
      // Reemplazar "Preparar Contexto" por "Cargar Cotización (Entrante)"
      conns['Historial de Conversación'].main[0] = mains[0]
        .filter(c => c.node !== 'Preparar Contexto')
        .concat([{ node: 'Cargar Cotización (Entrante)', type: 'main', index: 0 }]);
      changes.push('Reconectado: Historial → Cargar Cotización (Entrante)');
    }
  }
}

// "Cargar Cotización (Entrante)" → "Preparar Contexto"
if (!conns['Cargar Cotización (Entrante)']) {
  conns['Cargar Cotización (Entrante)'] = {
    main: [[{ node: 'Preparar Contexto', type: 'main', index: 0 }]]
  };
  changes.push('Conectado: Cargar Cotización (Entrante) → Preparar Contexto');
}

// ── 3. Modificar "Preparar Contexto" para inyectar datos del carrito ─────────
const preparar = byName('Preparar Contexto');
if (!preparar) throw new Error('No se encontró el nodo "Preparar Contexto"');

const NEW_PREPARAR_CODE = `const msgData  = $('¿Límite alcanzado?').first().json;
const isReset  = $('Parsear Mensaje WA').first().json.isReset === true;
const intent   = $('Detectar Intención').first().json;

// ── Historial (8 últimos, asc; cada mensaje truncado a 500 chars) ──
const HMAX = 500;
let historyArray = $('Historial de Conversación').all()
  .map(item => item.json)
  .filter(h => h && h.role && h.content)
  .reverse();
if (isReset) historyArray = [];
const esPrimerMensaje = historyArray.length === 0;

// ── Código de descuento mencionado en el mensaje actual ──
let discountRows = [];
try { discountRows = $('Cargar Códigos Descuento').first().json.body || []; } catch (e) {}

function normCode(s) {
  return (s || '').toString().toUpperCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

const msgNorm = normCode(msgData.textContent);
let matchedCode = null;
for (const row of discountRows) {
  const codeNorm = normCode(row.code);
  if (codeNorm && msgNorm.includes(codeNorm)) { matchedCode = row; break; }
}

let codeExpired = false;
let discountSection = '';
if (matchedCode) {
  codeExpired = !!(matchedCode.expires_at && new Date(matchedCode.expires_at) < new Date());
  if (codeExpired) {
    discountSection = '\\nCÓDIGO DE DESCUENTO: el cliente mencionó "' + matchedCode.code +
      '" pero ESTÁ EXPIRADO. Informa amablemente que ya no es válido. No apliques ningún descuento.';
  } else {
    const isPercent = matchedCode.type === 'percent';
    const minSub = Number(matchedCode.min_subtotal) || 0;
    discountSection = '\\nCÓDIGO DE DESCUENTO VÁLIDO: "' + matchedCode.code + '" ' +
      (isPercent ? '(' + Number(matchedCode.value) + '% off)' : '($' + Number(matchedCode.value).toLocaleString('es-CO') + ' off)') +
      (minSub > 0 ? ' · válido solo en compras desde $' + minSub.toLocaleString('es-CO') : '') +
      '.\\nLos precios del catálogo de abajo YA incluyen el descuento aplicado (precio final tachado→con descuento). NO recalcules ni inventes otro descuento ni otro monto; usa exactamente los precios que ves.';
  }
}
const discountActive = !!matchedCode && !codeExpired;

// ── Cotización del carrito web ──
let quoteSection = '';
try {
  const qRows = ($('Cargar Cotización (Entrante)').first().json.body) || [];
  if (qRows.length > 0) {
    const q = qRows[0];
    const qItems = Array.isArray(q.items) ? q.items : [];
    const sub  = Number(q.subtotal       || 0);
    const disc = Number(q.discount_amount || 0);
    const tot  = Number(q.total          || 0);
    const dcode = q.discount_code || null;
    if (qItems.length > 0 || tot > 0) {
      const itemLines = qItems.map(it =>
        '• ' + it.name + (it.size ? ' (talla ' + it.size + ')' : '') +
        ' x' + it.qty + ' — $' + (Number(it.price) * Number(it.qty)).toLocaleString('es-CO')
      ).join('\\n');
      quoteSection = '\\nCARRITO WEB (cotización #' + q.code + '):\\n' + itemLines;
      if (dcode && disc > 0) {
        quoteSection += '\\nSubtotal: $' + sub.toLocaleString('es-CO') +
          '\\nDescuento ' + dcode + ': -$' + disc.toLocaleString('es-CO');
      }
      quoteSection += '\\nTOTAL: $' + tot.toLocaleString('es-CO') +
        '\\n\\nEl cliente ya eligió estos productos en el catálogo web. Preséntale el resumen con el total final y continúa directo desde el paso 3 del flujo de compra (nombre completo). No le pidas que elija productos ni tallas de nuevo.';
    }
  }
} catch (e) {}

// ── Catálogo filtrado (compacto, sin blurb) ──
const products  = ($('Cargar Catálogo').first().json.body) || [];
const stockRows = ($('Cargar Stock').first().json.body) || [];
const stockMap  = {};
stockRows.forEach(r => { stockMap[r.product_id + '::' + r.size] = r.qty; });

const CAT_LABELS = { anillos:'ANILLOS', collares:'COLLARES', aretes:'ARETES', pulseras:'PULSERAS', piercings:'PIERCINGS' };
let siteUrl; try { siteUrl = $env.SITE_URL || 'vetajoyeria.co'; } catch(e) { siteUrl = 'vetajoyeria.co'; }

function precioConDescuento(base) {
  if (!discountActive) return null;
  if (matchedCode.type === 'percent') return Math.round(base * (1 - Number(matchedCode.value) / 100));
  return Math.max(0, Math.round(base - Number(matchedCode.value)));
}

let catalogSection = '';
if (intent.catalogMode === 'full_catalog') {
  catalogSection = 'CATÁLOGO: el cliente quiere explorar. Envíale el link ' + siteUrl +
    ' (catálogo con stock en tiempo real) y ofrécele orientarlo. No listes productos en el chat.';
} else if ((intent.catalogMode === 'category' || intent.catalogMode === 'product') && products.length > 0) {
  const byCat = {};
  products.forEach(p => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
  let catText = '';
  for (const cat of Object.keys(CAT_LABELS)) {
    const list = byCat[cat];
    if (!list || !list.length) continue;
    catText += '\\n' + CAT_LABELS[cat] + ':\\n';
    for (const p of list) {
      const base = Number(p.price);
      const final = precioConDescuento(base);
      const precio = final != null
        ? '$' + base.toLocaleString('es-CO') + ' → $' + final.toLocaleString('es-CO') + ' (con ' + matchedCode.code + ')'
        : '$' + base.toLocaleString('es-CO');
      const sizes  = Array.isArray(p.sizes) ? p.sizes : [];
      const dispo  = sizes.map(sz => {
        const q = stockMap[p.id + '::' + sz];
        return (q !== undefined && q <= 0) ? sz + '(agotada)' : sz;
      });
      const hayAlgo = sizes.length === 0 ||
        sizes.some(sz => { const q = stockMap[p.id + '::' + sz]; return q === undefined || q > 0; });
      const tallas = dispo.length ? dispo.join(',') : 'única';
      catText += '• ' + p.name + ' (' + p.id + ') ' + precio + ' · ' +
        p.material + ' ' + p.finish + ' · T:' + tallas + (hayAlgo ? '' : ' [AGOTADO]') + '\\n';
    }
  }
  if (catText) catalogSection = 'CATÁLOGO (stock real):\\n' + catText +
    '\\nOfrece solo lo de arriba. "(agotada)"/[AGOTADO] → no lo ofrezcas, propón alternativa.';
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
  saludoInstruccion = 'NUEVA SESIÓN: el cliente pidió empezar de cero. (1) acusa recibo con calidez, (2) preséntate: "Soy Luna, asesora de VETA 🌙", (3) pregunta "¿Con quién tengo el gusto?".';
} else if (esPrimerMensaje) {
  saludoInstruccion = 'PRIMER CONTACTO: saluda con calidez, preséntate como "Luna, asesora de VETA 🌙" y pregunta con quién tienes el gusto.';
} else {
  saludoInstruccion = 'CLIENTE RECURRENTE: ' + (pedidosRows.length > 0
    ? 'tiene ' + pedidosRows.length + ' pedido(s) previo(s). Salúdalo por nombre, sin presentarte. Ofrece: seguimiento al pedido reciente (' + pedidosRows[0].items + ', ' + pedidosRows[0].status + '), nuevo pedido, catálogo o dudas.'
    : 'salúdalo por nombre, sin presentarte de nuevo.');
}

const SYSTEM_PROMPT =
\`Eres Luna, asesora de ventas de VETA (joyería minimalista colombiana de autor) por WhatsApp.

\${saludoInstruccion}

IDENTIDAD: Te llamas Luna. Si preguntan: "Soy Luna, asesora de VETA 🌙". No te repitas si ya hay historial.

TONO: Cálida, cercana, español colombiano ("con gusto", "claro que sí"). 1-3 emojis, máx ~4 líneas (salvo al mostrar productos). No presiones; cierra con un paso útil.

FLUJO DE COMPRA (orden estricto):
1. Confirma pieza(s) y talla(s). Si no sabe la talla → guíala a \${siteUrl}#care.
2. Resumen: pieza, talla, acabado, precio.
3. Nombre completo.
4. Ciudad y dirección (cualquier formato colombiano válido).
5. Pago: transferencia/Nequi o contraentrega.
6. ¿Regalo? Si sí, nombre del destinatario.
7. Resumen completo → "¿Confirmas este pedido?".
8. SOLO con confirmación explícita (sí/confirmo/listo/ok/dale) generas el tag.

Al confirmar: escribe PRIMERO un mensaje cálido visible para el cliente; el tag va en línea aparte al final, nunca solo.

Obligatorios: nombre, ciudad, dirección, pago. Opcionales (vacíos si no aplican): barrio, ref, destinatario, notes_cliente.
dir = calle+número o nombre del conjunto/portal. ref = apto/casa/piso/torre/portería. notes_cliente = instrucciones especiales. No insistas en calle+número si ya dio un lugar identificable.

Tag (EXACTO, al final):
[PEDIDO_CONFIRMADO: nombre=X | ciudad=X | items=PIEZA(talla)xCANT | pago=X | dir=X | barrio=X | ref=X | destinatario=X | notes_cliente=X]

ESCALA solo si el cliente lo pide, o hay queja/reclamo/problema con un pedido. Token interno [ESCALAR] (nunca lo menciones).

FAQ: Envío 3-5 días hábiles, solo Colombia. Pago: transferencia, Nequi, Daviplata o contraentrega. Materiales: plata 925, oro laminado 18k sobre plata 925, piercings acero quirúrgico. Garantía de por vida en la estructura. Tallas: \${siteUrl}#care.
\${pedidosResumen}
\${catalogSection}
\${discountSection}
\${quoteSection}\`;

const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  ...historyArray.map(row => ({
    role: row.role === 'user' ? 'user' : 'assistant',
    content: (row.content || '').length > HMAX ? (row.content.slice(0, HMAX) + '…') : row.content
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

if (preparar.parameters.jsCode !== NEW_PREPARAR_CODE) {
  preparar.parameters.jsCode = NEW_PREPARAR_CODE;
  changes.push('Preparar Contexto: inyecta datos del carrito web (quoteSection) en el prompt de Luna');
}

// ── Guardar ──────────────────────────────────────────────────────────────────
if (!changes.length) {
  console.log('Sin cambios: el flujo ya tenía el parche de cotización aplicado.');
} else {
  fs.writeFileSync(path, JSON.stringify(wf, null, 2) + '\n', 'utf8');
  console.log('Flujo parcheado (' + wf.nodes.length + ' nodos). Cambios:');
  changes.forEach(c => console.log('  ✓ ' + c));
  console.log('\nDespliega con:');
  console.log('  node deploy-n8n-chat.js');
}
