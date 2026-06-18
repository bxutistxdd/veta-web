const { Client } = require('pg');
const c = new Client({ host:'zephyr.proxy.rlwy.net', port:16721, user:'postgres', password:'***REMOVED_PG_PASSWORD***', database:'railway', ssl:{ rejectUnauthorized:false } });
(async () => {
  await c.connect();
  const { rows } = await c.query(
    'SELECT wh.nodes, wh."versionId" FROM workflow_entity we JOIN workflow_history wh ON wh."versionId"=we."activeVersionId" WHERE we.id=$1',
    ['llOTK0AgzAiFHrEA']);
  const nodes = rows[0].nodes;
  const pc = nodes.find(n => n.name === 'Preparar Contexto');
  const gq = nodes.find(n => n.name === 'Groq - Asesora VETA');
  console.log('=== SNAPSHOT ACTIVO EN PRODUCCION (v2) ===');
  console.log('versionId activo            :', rows[0].versionId);
  console.log('Historial truncado (500)    :', /slice\(0, HMAX\)/.test(pc.parameters.jsCode));
  console.log('Tag EXACTO intacto          :', /PEDIDO_CONFIRMADO: nombre=X/.test(pc.parameters.jsCode));
  console.log('Groq max_tokens 512         :', /max_tokens":512/.test(gq.parameters.jsonBody));
  console.log('Groq auth OK                :', /\$env\.GROQ_API_KEY/.test(gq.parameters.headerParameters.parameters.find(p=>p.name==='Authorization').value));
  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
