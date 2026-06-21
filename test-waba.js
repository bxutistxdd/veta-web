const https = require('https');

const WA_TOKEN = (process.env.WA_TOKEN);
const WABA_ID = '999855739698017';

function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'graph.facebook.com',
      path,
      method,
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(buf) }); } catch { resolve({ s: res.statusCode, d: buf }); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // 1. Listar plantillas existentes
  console.log('--- GET templates ---');
  const list = await call('GET', `/v21.0/${WABA_ID}/message_templates?fields=name,status&limit=10`);
  console.log(`HTTP ${list.s}:`, JSON.stringify(list.d));

  // 2. Intentar crear plantilla de prueba
  console.log('\n--- POST crear veta_pedido_nuevo ---');
  const create = await call('POST', `/v21.0/${WABA_ID}/message_templates`, {
    name: 'veta_pedido_nuevo',
    category: 'UTILITY',
    language: 'es',
    components: [{
      type: 'BODY',
      text: '🛒 Nuevo pedido VETA #{{1}}\n\nProducto: {{2}}\nCliente: {{3}}\nCiudad: {{4}}\nPago: {{5}}\n{{6}}\n\nGestiona en #admin → Despachos.',
    }],
  });
  console.log(`HTTP ${create.s}:`, JSON.stringify(create.d));
})().catch(console.error);
