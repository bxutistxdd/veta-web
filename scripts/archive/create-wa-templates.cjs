// Crea las 3 plantillas de WhatsApp en Meta para notificaciones confiables.
// Ejecutar: ! railway run --service n8n node create-wa-templates.js
// Si WA_TOKEN o WABA_ID no están en Railway: node create-wa-templates.js <TOKEN> <WABA_ID>
//
// WABA_ID: Meta Business Suite → Cuentas de WhatsApp → tu cuenta → columna ID

const https = require('https');

const WA_TOKEN         = process.env.WA_TOKEN || process.argv[2];
const PHONE_NUMBER_ID  = process.env.WA_PHONE_NUMER_ID || '1216679024851056';
let   WABA_ID          = process.env.WABA_ID || process.env.WA_WABA_ID || process.argv[3];

// ── Templates ──────────────────────────────────────────────────────────────
// example.body_text es obligatorio para que Meta apruebe variables {{n}}.
const TEMPLATES = [
  {
    name: 'veta_nuevo_pedido',
    category: 'UTILITY',
    language: 'es',
    body: '🛒 Nuevo pedido VETA #{{1}}\n\nProducto: {{2}}\nCliente: {{3}}\nCiudad: {{4}}\nPago: {{5}}\nNotas: {{6}}\n\nGestiona en #admin → Despachos.',
    example: ['1042', 'Anillo Vena (talla 7) x1', 'Maria Gomez +573001234567', 'Bogota, Cra 13 #45-67', 'Nequi', 'Para: Laura. Empaque de regalo'],
  },
  {
    name: 'veta_requiere_asesor',
    category: 'UTILITY',
    language: 'es',
    body: '🔔 Cliente pide asesor\n\nNúmero: +{{1}}\nÚltimo mensaje: {{2}}\n\nAbre #admin > Chats para atenderlo.',
    example: ['573001234567', 'Tengo un problema con mi pedido'],
  },
  {
    name: 'veta_cliente_en_espera',
    category: 'UTILITY',
    language: 'es',
    body: '👤 Cliente esperando asesor\n\nNúmero: +{{1}}\nMensajes usados: {{2}}/10\n\nYa fue avisado y te está esperando.',
    example: ['573001234567', '10'],
  },
];

// ── HTTP helper ─────────────────────────────────────────────────────────────
function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'graph.facebook.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, data: buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Descubrir WABA ID a partir del Phone Number ID ──────────────────────────
async function discoverWabaId() {
  console.log(`Descubriendo WABA ID desde número ${PHONE_NUMBER_ID}...`);
  const r = await apiCall('GET', `/v21.0/${PHONE_NUMBER_ID}`, null);
  const waba = r.data?.whatsapp_business_account_id
    || r.data?.account_id
    || r.data?.id;
  if (r.status !== 200) {
    console.log('Respuesta lookup:', JSON.stringify(r.data));
  }
  return waba !== PHONE_NUMBER_ID ? waba : null; // no devolver el mismo ID
}

// ── Crear plantilla ─────────────────────────────────────────────────────────
async function createTemplate(wabaId, tpl) {
  return apiCall('POST', `/v21.0/${wabaId}/message_templates`, {
    name: tpl.name,
    category: tpl.category,
    language: tpl.language,
    components: [{
      type: 'BODY',
      text: tpl.body,
      example: { body_text: [tpl.example] },
    }],
  });
}

// Borra cualquier versión previa (p.ej. REJECTED) para poder recrear con el mismo nombre.
async function deleteTemplate(wabaId, name) {
  return apiCall('DELETE', `/v21.0/${wabaId}/message_templates?name=${encodeURIComponent(name)}`, null);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!WA_TOKEN) {
    console.error('ERROR: No se encontró WA_TOKEN.');
    console.error('Ejecuta: railway run --service n8n node create-wa-templates.js');
    process.exit(1);
  }

  if (!WABA_ID) {
    WABA_ID = await discoverWabaId();
  }

  if (!WABA_ID) {
    console.error('\nNo se pudo descubrir el WABA_ID automáticamente.');
    console.error('Búscalo en: Meta Business Suite → Cuentas de WhatsApp → columna "ID de cuenta"');
    console.error('Luego ejecuta: railway run --service n8n node create-wa-templates.js "" <WABA_ID>');
    console.error('O agrega WABA_ID como variable en el servicio n8n de Railway.');
    process.exit(1);
  }

  console.log('WABA_ID:', WABA_ID);
  console.log('\nCreando plantillas...\n');

  for (const tpl of TEMPLATES) {
    await deleteTemplate(WABA_ID, tpl.name); // limpia versión rechazada previa
    const r = await createTemplate(WABA_ID, tpl);
    if (r.status === 200 && r.data.id) {
      console.log(`✅ ${tpl.name} → ID ${r.data.id} | estado: ${r.data.status}`);
    } else if (r.data?.error?.error_subcode === 2388085 || r.data?.error?.code === 136006) {
      console.log(`⚠️  ${tpl.name} → Ya existe (se puede usar)`);
    } else {
      console.log(`❌ ${tpl.name} → HTTP ${r.status}:`, JSON.stringify(r.data?.error || r.data));
    }
  }

  console.log('\n─────────────────────────────────────────────');
  console.log('Próximo paso:');
  console.log('Espera 1-10 min y ejecuta: railway run --service n8n node check-wa-templates.js');
}

main().catch(console.error);
