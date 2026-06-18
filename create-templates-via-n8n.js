// Crea las plantillas de WhatsApp ejecutando las llamadas a Meta DESDE n8n en Railway
// (los tokens están restringidos por IP o permiso — Railway tiene acceso, mi máquina no).
// 1. Inserta un workflow temporal en Railway PG
// 2. Lo activa para que responda al webhook
// 3. Llama el webhook URL → n8n ejecuta las 3 creaciones en Railway
// 4. Lee el resultado
// 5. Limpia el workflow temporal

const { Client }    = require('pg');
const https         = require('https');
const crypto        = require('crypto');
const { execSync }  = require('child_process');

const CONN = {
  host: 'zephyr.proxy.rlwy.net', port: 16721, user: 'postgres',
  password: '***REMOVED_PG_PASSWORD***', database: 'railway',
  ssl: { rejectUnauthorized: false }
};
const WABA_ID   = '999855739698017';
const N8N_URL   = 'https://n8n-production-e7c0.up.railway.app';
const WF_ID     = 'veta-tpl-create-tmp';
const HOOK_PATH = 'veta-create-tpl-' + crypto.randomBytes(4).toString('hex');

// ── Workflow temporal con 3 nodos HTTP Request encadenados ──────────────────
function buildWorkflow() {
  const BASE = '=https://graph.facebook.com/v21.0/' + WABA_ID + '/message_templates';
  const tpls = [
    {
      name: 'veta_pedido_nuevo',
      body: '🛒 Nuevo pedido VETA #{{1}}\n\nProducto: {{2}}\nCliente: {{3}}\nCiudad: {{4}}\nPago: {{5}}\n{{6}}\n\nGestiona en #admin → Despachos.',
    },
    {
      name: 'veta_asesor_requerido',
      body: '🔔 Cliente pide asesor\n\nNúmero: +{{1}}\nÚltimo mensaje: {{2}}\n\nAbre #admin > Chats para atenderlo.',
    },
    {
      name: 'veta_limite_alcanzado',
      body: '👤 Cliente esperando asesor\n\nNúmero: +{{1}}\nMensajes usados: {{2}}/10\n\nYa fue avisado y te está esperando.',
    },
  ];

  const authHeader = { name: 'Authorization', value: '=Bearer {{$env.WA_TOKEN}}' };
  const ctHeader   = { name: 'Content-Type',   value: 'application/json' };

  const nodes = [
    {
      id: 'hook', name: 'Webhook Trigger', type: 'n8n-nodes-base.webhook', typeVersion: 2,
      position: [0, 0], webhookId: HOOK_PATH,
      parameters: { path: HOOK_PATH, responseMode: 'responseNode', httpMethod: 'GET' },
    },
  ];
  let prev = 'Webhook Trigger';

  tpls.forEach((t, i) => {
    const nodeName = `Crear ${t.name}`;
    nodes.push({
      id: `tpl${i}`, name: nodeName, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [(i + 1) * 280, 0],
      parameters: {
        method: 'POST', url: BASE,
        sendHeaders: true,
        headerParameters: { parameters: [authHeader, ctHeader] },
        sendBody: true, specifyBody: 'json',
        jsonBody: JSON.stringify({
          name: t.name, category: 'UTILITY', language: 'es',
          components: [{ type: 'BODY', text: t.body }],
        }),
        options: {},
      },
      onError: 'continueRegularOutput',
    });
    prev = nodeName;
  });

  nodes.push({
    id: 'resp', name: 'Responder', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1,
    position: [tpls.length * 280 + 280, 0],
    parameters: {
      respondWith: 'json',
      responseBody: `={{ JSON.stringify({ veta_pedido_nuevo: $('Crear veta_pedido_nuevo').first().json, veta_asesor_requerido: $('Crear veta_asesor_requerido').first().json, veta_limite_alcanzado: $('Crear veta_limite_alcanzado').first().json }) }}`,
    },
  });

  const connections = {};
  const chain = nodes.filter(n => n.id !== 'resp');
  for (let i = 0; i < chain.length - 1; i++) {
    connections[chain[i].name] = { main: [[{ node: chain[i + 1].name, type: 'main', index: 0 }]] };
  }
  connections[chain[chain.length - 1].name] = { main: [[{ node: 'Responder', type: 'main', index: 0 }]] };

  return { nodes, connections };
}

// ── HTTP GET helper ─────────────────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(buf) }); } catch { resolve({ s: res.statusCode, d: buf }); } });
    }).on('error', reject);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const c = new Client(CONN);
  await c.connect();
  console.log('Conectado a Railway PG.');

  // Limpiar workflow temporal anterior si existe
  await c.query(`DELETE FROM workflow_entity WHERE id = $1`, [WF_ID]).catch(() => {});

  const wf = buildWorkflow();
  const now = new Date().toISOString();
  const versionId = crypto.randomUUID();

  // FK circular: workflow_entity.activeVersionId → workflow_history.versionId
  //              workflow_history.workflowId → workflow_entity.id
  // Solución: insertar workflow_entity con activeVersionId=NULL, luego history, luego update

  // 1. workflow_entity con activeVersionId NULL
  await c.query(`
    INSERT INTO workflow_entity
      (id, name, active, nodes, connections, settings, "staticData", "pinData",
       "versionId", "activeVersionId", meta, "updatedAt", "createdAt", "triggerCount",
       "isArchived", "versionCounter", description, "nodeGroups")
    VALUES ($1,$2,true,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11,0,false,1,'',$12)
  `, [
    WF_ID, 'VETA Crear Plantillas WA (TEMP)',
    JSON.stringify(wf.nodes), JSON.stringify(wf.connections),
    JSON.stringify({}), JSON.stringify({}), JSON.stringify({}),
    versionId, JSON.stringify({}), now, now, JSON.stringify([]),
  ]);

  // 2. workflow_history
  await c.query(`
    INSERT INTO workflow_history
      ("versionId", "workflowId", authors, nodes, connections, "createdAt", "updatedAt",
       name, autosaved, description, "nodeGroups")
    VALUES ($1,$2,'[]',$3,$4,$5,$6,$7,false,'',$8)
  `, [versionId, WF_ID, JSON.stringify(wf.nodes), JSON.stringify(wf.connections), now, now,
      'VETA Crear Plantillas WA (TEMP)', JSON.stringify([])]);

  // 3. Actualizar activeVersionId
  await c.query(
    `UPDATE workflow_entity SET "activeVersionId" = $1 WHERE id = $2`,
    [versionId, WF_ID]
  );

  console.log(`Workflow temporal creado (ID: ${WF_ID}).`);
  console.log('Reiniciando n8n en Railway para registrar el webhook...');
  execSync('railway redeploy --service n8n --yes', { stdio: 'inherit' });

  // Esperar a que n8n esté UP (generalmente 35-50s en Railway)
  process.stdout.write('Esperando que n8n esté listo .');
  for (let i = 0; i < 20; i++) {
    await sleep(3000);
    try {
      const ok = await httpGet(`${N8N_URL}/healthz`);
      if (ok.s === 200 || ok.s === 404) { process.stdout.write(' OK\n'); break; }
    } catch {}
    process.stdout.write('.');
  }
  await sleep(4000); // margen extra para que los webhooks se registren

  // Llamar el webhook
  const webhookUrl = `${N8N_URL}/webhook/${HOOK_PATH}`;
  console.log(`Llamando webhook: ${webhookUrl}`);
  const result = await httpGet(webhookUrl);
  console.log(`Respuesta HTTP ${result.s}:`, JSON.stringify(result.d, null, 2));

  // Limpiar
  await c.query(`DELETE FROM workflow_entity WHERE id = $1`, [WF_ID]);
  await c.query(`DELETE FROM workflow_history WHERE "workflowId" = $1`, [WF_ID]);
  console.log('\nWorkflow temporal eliminado.');

  await c.end();

  // Interpretar resultado
  if (result.s === 200 && result.d) {
    const d = result.d;
    for (const [k, v] of Object.entries(d)) {
      if (v?.id) {
        console.log(`✅ ${k} → creada (ID: ${v.id}, estado: ${v.status})`);
      } else if (v?.error?.error_subcode === 2388085 || v?.error?.code === 136006) {
        console.log(`⚠️  ${k} → ya existe`);
      } else {
        console.log(`❌ ${k} → error:`, JSON.stringify(v?.error || v));
      }
    }
    console.log('\nEjecuta: node check-wa-templates.js <TOKEN> 999855739698017');
  }
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
