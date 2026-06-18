const { Client } = require('pg');
const c = new Client({
  host: 'zephyr.proxy.rlwy.net', port: 16721, user: 'postgres',
  password: '***REMOVED_PG_PASSWORD***', database: 'railway',
  ssl: { rejectUnauthorized: false }
});
(async () => {
  await c.connect();
  // Listar todas las tablas del schema n8n
  const { rows } = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `);
  console.log('=== Tablas ===');
  rows.forEach(r => console.log(r.table_name));

  // Ver si existe webhook_entity
  const { rows: wh } = await c.query(`
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_name = 'webhook_entity'
  `);
  console.log('\nwebhook_entity existe:', wh[0].count > 0);

  // Ver workflow recién insertado si existe
  const { rows: wf } = await c.query(`SELECT id, name, active, "activeVersionId" FROM workflow_entity WHERE id LIKE 'veta-tpl%'`);
  console.log('\nWorkflows VETA temp:', wf);
  await c.end();
})().catch(console.error);
