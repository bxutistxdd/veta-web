const { Client } = require('pg');
const https = require('https');

const CONN = {
  host: 'zephyr.proxy.rlwy.net', port: 16721, user: 'postgres',
  password: process.env.RAILWAY_PG_PASSWORD, database: 'railway',
  ssl: { rejectUnauthorized: false }
};
const WA_TOKEN = (process.env.WA_TOKEN);
const PHONE_ID = '1216679024851056';

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Authorization: `Bearer ${WA_TOKEN}` } }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } });
    });
    req.on('error', reject);
  });
}

(async () => {
  // 1. Buscar WABA ID en ejecuciones recientes de n8n (entry[0].id del webhook de Meta)
  const c = new Client(CONN);
  await c.connect();
  console.log('Buscando WABA ID en execution_data...');

  const { rows } = await c.query(`
    SELECT ed.data FROM execution_entity ee
    JOIN execution_data ed ON ee.id = ed."executionId"
    WHERE ee."workflowId" = 'llOTK0AgzAiFHrEA' AND ee.status = 'success'
    ORDER BY ee.id DESC LIMIT 10
  `);

  const seen = new Set([PHONE_ID]);
  for (const row of rows) {
    const raw = JSON.stringify(row.data);
    // entry[0].id en payload de Meta = WABA ID (14-16 dígitos, diferente al phone ID)
    const matches = [...raw.matchAll(/"id":"(\d{14,16})"/g)].map(m => m[1]);
    matches.filter(id => !seen.has(id)).forEach(id => {
      seen.add(id);
      console.log('WABA_ID candidato desde PG:', id);
    });
  }
  await c.end();

  // 2. Intentar endpoint de WhatsApp Business Account del número
  console.log('\nIntentando /v21.0/' + PHONE_ID + '/whatsapp_business_account ...');
  const r1 = await get(`https://graph.facebook.com/v21.0/${PHONE_ID}/whatsapp_business_account`);
  console.log('Respuesta:', JSON.stringify(r1));

  // 3. Intentar listar templates directamente con varios candidatos conocidos
  const candidatos = [...seen].filter(id => id !== PHONE_ID);
  for (const waba of candidatos) {
    console.log(`\nIntentando templates con WABA_ID ${waba}...`);
    const r = await get(`https://graph.facebook.com/v21.0/${waba}/message_templates?fields=name,status&limit=5`);
    console.log('Respuesta:', JSON.stringify(r).slice(0, 300));
    if (r.data || (r.error && r.error.code !== 100)) {
      console.log('>>> WABA_ID correcto:', waba);
    }
  }
})().catch(console.error);
