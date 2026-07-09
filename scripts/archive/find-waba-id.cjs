// Busca el WABA ID en los payloads crudos de webhook guardados en n8n PG
const { Client } = require('pg');

const CONN = {
  host: 'zephyr.proxy.rlwy.net', port: 16721, user: 'postgres',
  password: process.env.RAILWAY_PG_PASSWORD, database: 'railway',
  ssl: { rejectUnauthorized: false }
};

(async () => {
  const c = new Client(CONN);
  await c.connect();

  // execution_data almacena los outputs de cada nodo; buscar cualquier número
  // largo que aparezca junto a "whatsapp_business_account" o "entry"
  const { rows } = await c.query(`
    SELECT ed.data::text as raw
    FROM execution_entity ee
    JOIN execution_data ed ON ee.id = ed."executionId"
    WHERE ee."workflowId" = 'llOTK0AgzAiFHrEA'
    ORDER BY ee.id DESC LIMIT 5
  `);

  const phone = '1216679024851056';
  const seen  = new Set();

  for (const row of rows) {
    const raw = row.raw;
    // Buscar todos los números de 10-17 dígitos en el JSON
    const all = [...raw.matchAll(/\b(\d{10,17})\b/g)].map(m => m[1]);
    all.filter(n => n !== phone && !seen.has(n)).forEach(n => {
      seen.add(n);
      // Mostrar contexto alrededor del número
      const idx = raw.indexOf(n);
      const ctx = raw.slice(Math.max(0, idx - 60), idx + n.length + 60)
        .replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ');
      console.log(`Candidato [${n}] contexto: ...${ctx}...`);
    });
  }

  if (!seen.size) {
    console.log('No se encontraron IDs en execution_data.');
    // Intentar tabla wa_conversations para ver si hay metadatos
    const { rows: convs } = await c.query(`SELECT * FROM wa_conversations LIMIT 1`).catch(() => ({ rows: [] }));
    if (convs.length) console.log('wa_conversations sample:', JSON.stringify(convs[0]).slice(0, 200));
  }

  await c.end();
})().catch(console.error);
