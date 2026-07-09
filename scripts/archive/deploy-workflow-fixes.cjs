const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'zephyr.proxy.rlwy.net',
  port: 16721,
  user: 'postgres',
  password: process.env.RAILWAY_PG_PASSWORD,
  database: 'railway',
  ssl: { rejectUnauthorized: false }
});

const WORKFLOW_ID = 'llOTK0AgzAiFHrEA';
const workflowPath = path.join(__dirname, 'veta-whatsapp-flow.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

async function deploy() {
  await client.connect();
  console.log('Conectado a Railway PostgreSQL');

  // 1. Obtener activeVersionId
  const { rows: wfRows } = await client.query(
    `SELECT "activeVersionId" FROM workflow_entity WHERE id = $1`,
    [WORKFLOW_ID]
  );
  if (!wfRows.length) throw new Error('Workflow no encontrado: ' + WORKFLOW_ID);
  const activeVersionId = wfRows[0].activeVersionId;
  console.log('activeVersionId:', activeVersionId);

  const nodesJson = JSON.stringify(workflow.nodes);
  const connectionsJson = JSON.stringify(workflow.connections);
  const newVersionId = workflow.versionId;

  // 2. Actualizar workflow_history — solo nodes y connections, mantener versionId
  const { rowCount: histCount } = await client.query(
    `UPDATE workflow_history
     SET nodes = $1::jsonb, connections = $2::jsonb
     WHERE "workflowId" = $3 AND "versionId" = $4`,
    [nodesJson, connectionsJson, WORKFLOW_ID, activeVersionId]
  );
  console.log('workflow_history actualizado:', histCount, 'fila(s)');

  // 3. Actualizar workflow_entity (borrador)
  const { rowCount: entCount } = await client.query(
    `UPDATE workflow_entity
     SET nodes = $1::jsonb, connections = $2::jsonb, "updatedAt" = NOW()
     WHERE id = $3`,
    [nodesJson, connectionsJson, WORKFLOW_ID]
  );
  console.log('workflow_entity actualizado:', entCount, 'fila(s)');

  await client.end();
  console.log('Listo. Ahora reinicia n8n con: railway redeploy --service n8n --yes');
}

deploy().catch(err => {
  console.error('ERROR:', err.message);
  client.end().catch(() => {});
  process.exit(1);
});
