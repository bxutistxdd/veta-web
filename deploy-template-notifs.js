// Actualiza veta-whatsapp-flow.json para usar plantillas de WhatsApp
// en los 3 nodos de notificación. Sin plantillas, Meta rechaza los
// mensajes salientes si la ventana de 24h está cerrada.
//
// Ejecutar DESPUÉS de que check-wa-templates.js confirme todas APPROVED:
//   ! node deploy-template-notifs.js
// Luego:
//   ! node deploy-n8n-chat.js
//   ! railway redeploy --service n8n --yes

const fs   = require('fs');
const path = require('path');

const FLOW_PATH = path.join(__dirname, 'veta-whatsapp-flow.json');

// ── Payloads de plantilla (n8n evalúa {{ expression }} en el string) ────────

// Nodo: "Notificar Pedido al Equipo" (id: 1048274f-413c-4ce4-9d88-d8fe874b3a02)
// $json llega desde Supabase "Guardar Pedido" (Prefer: return=representation)
const BODY_PEDIDO =
  `={"messaging_product":"whatsapp","to":"{{$env.WA_NOTIFY_NUMBER}}","type":"template","template":{"name":"veta_pedido_nuevo","language":{"code":"es"},"components":[{"type":"body","parameters":[` +
  `{"type":"text","text":"{{ $json.order_number }}"},` +
  `{"type":"text","text":"{{ $json.items }}"},` +
  `{"type":"text","text":"{{ $json.customer_name }} +{{ $json.phone }}"},` +
  `{"type":"text","text":"{{ $json.city }}{{ $json.neighborhood ? ', ' + $json.neighborhood : '' }}, {{ $json.address }}{{ $json.apt_ref ? ' (' + $json.apt_ref + ')' : '' }}"},` +
  `{"type":"text","text":"{{ $json.payment_method }}"},` +
  `{"type":"text","text":"{{ (($json.recipient_name ? 'Para: '+$json.recipient_name+'. ' : '') + ($json.delivery_notes || '')) || 'Sin notas adicionales' }}"}` +
  `]}]}}`;

// Nodo: "Notificar Asesor (Escalamiento)" (id: c2000000-0000-0000-0000-000000000003)
// $json.from y $json.userMessage vienen de Preparar Contexto
const BODY_ASESOR =
  `={"messaging_product":"whatsapp","to":"{{$env.WA_NOTIFY_NUMBER}}","type":"template","template":{"name":"veta_asesor_requerido","language":{"code":"es"},"components":[{"type":"body","parameters":[` +
  `{"type":"text","text":"{{ $json.from }}"},` +
  `{"type":"text","text":"{{ ($json.userMessage || '').slice(0, 150) }}"}` +
  `]}]}}`;

// Nodo: "Notificar a Sebastian (límite)" (id: c5850f81-6e36-495c-a21d-20fb46a13ffa)
// $json.from y $json.mensajesHoy vienen de "¿Límite alcanzado?"
const BODY_LIMITE =
  `={"messaging_product":"whatsapp","to":"{{$env.WA_NOTIFY_NUMBER}}","type":"template","template":{"name":"veta_limite_alcanzado","language":{"code":"es"},"components":[{"type":"body","parameters":[` +
  `{"type":"text","text":"{{ $json.from }}"},` +
  `{"type":"text","text":"{{ $json.mensajesHoy }}"}` +
  `]}]}}`;

// ── Mapa de nodos a actualizar ───────────────────────────────────────────────
const PATCHES = {
  '1048274f-413c-4ce4-9d88-d8fe874b3a02': { name: 'Notificar Pedido al Equipo',    body: BODY_PEDIDO  },
  'c2000000-0000-0000-0000-000000000003':  { name: 'Notificar Asesor (Escalamiento)', body: BODY_ASESOR  },
  'c5850f81-6e36-495c-a21d-20fb46a13ffa': { name: 'Notificar a Sebastian (límite)', body: BODY_LIMITE  },
};

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const flow = JSON.parse(fs.readFileSync(FLOW_PATH, 'utf8'));

  let patched = 0;
  for (const node of flow.nodes) {
    const patch = PATCHES[node.id];
    if (!patch) continue;

    const old = node.parameters.jsonBody;
    node.parameters.jsonBody = patch.body;

    const wasTemplate = old && old.includes('"type":"template"');
    const icon = wasTemplate ? '↺' : '✓';
    console.log(`${icon} ${patch.name}`);
    if (wasTemplate) console.log('  (ya era plantilla, se sobreescribe)');
    patched++;
  }

  if (patched === 0) {
    console.error('ERROR: No se encontró ninguno de los 3 nodos. ¿Es el flujo correcto?');
    process.exit(1);
  }

  if (patched < Object.keys(PATCHES).length) {
    console.warn(`\n⚠️  Solo se actualizaron ${patched} de ${Object.keys(PATCHES).length} nodos.`);
    console.warn('Revisa los IDs de nodo si alguna notificación sigue sin funcionar.');
  }

  fs.writeFileSync(FLOW_PATH, JSON.stringify(flow, null, 2), 'utf8');
  console.log(`\n✅ ${patched} nodos actualizados en veta-whatsapp-flow.json`);
  console.log('\nPróximos pasos:');
  console.log('  1. node deploy-n8n-chat.js');
  console.log('  2. railway redeploy --service n8n --yes');
}

main();
