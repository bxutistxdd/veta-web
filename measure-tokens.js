// Mide el consumo REAL de tokens de Groq leyendo las ejecuciones de n8n.
const { Client } = require('pg');
const c = new Client({ host:'zephyr.proxy.rlwy.net', port:16721, user:'postgres', password:'***REMOVED_PG_PASSWORD***', database:'railway', ssl:{ rejectUnauthorized:false } });

(async () => {
  await c.connect();
  const { rows } = await c.query(
    `SELECT ed."executionId", ed.data, ee."startedAt", ee.status
     FROM execution_data ed
     JOIN execution_entity ee ON ee.id = ed."executionId"
     WHERE ee."workflowId" = $1
     ORDER BY ed."executionId" DESC
     LIMIT 300`, ['llOTK0AgzAiFHrEA']);

  console.log('Ejecuciones analizadas:', rows.length);

  // Extrae cada campo por separado (el orden/campos extra de Groq varían)
  const grab = (txt, field) => {
    const out = [];
    const re = new RegExp('"' + field + '":\\s*(\\d+)', 'g');
    let m; while ((m = re.exec(txt)) !== null) out.push(+m[1]);
    return out;
  };

  const prompts = [], comps = [], totals = [];
  let firstCtx = null;
  for (const r of rows) {
    const txt = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    if (!firstCtx && txt.includes('total_tokens')) {
      const i = txt.indexOf('total_tokens');
      firstCtx = txt.slice(Math.max(0, i - 220), i + 40);
    }
    prompts.push(...grab(txt, 'prompt_tokens'));
    comps.push(...grab(txt, 'completion_tokens'));
    totals.push(...grab(txt, 'total_tokens'));
  }

  console.log('\nContexto crudo alrededor del primer total_tokens:');
  console.log(firstCtx || '(ninguno)');

  const stat = (arr, name) => {
    if (!arr.length) { console.log(name, ': sin datos'); return; }
    const s = arr.reduce((a,b)=>a+b,0);
    console.log(`${name}: n=${arr.length} avg=${Math.round(s/arr.length)} min=${Math.min(...arr)} max=${Math.max(...arr)}`);
  };
  console.log('\n=== CONSUMO REAL DE GROQ ===');
  stat(prompts, 'prompt_tokens   ');
  stat(comps,   'completion_tokens');
  stat(totals,  'total_tokens    ');
  console.log('\nÚltimos total_tokens:', totals.slice(0, 20).join(', '));

  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
