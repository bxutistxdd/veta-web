// Verifica el estado de aprobación de las plantillas VETA en Meta.
// Ejecutar: ! railway run --service n8n node check-wa-templates.js
// O: node check-wa-templates.js <TOKEN> <WABA_ID>

const https = require('https');

const WA_TOKEN = process.env.WA_TOKEN || process.argv[2];
const WABA_ID  = process.env.WABA_ID  || process.env.WA_WABA_ID || process.argv[3];

const NAMES = ['veta_pedido_nuevo', 'veta_asesor_requerido', 'veta_limite_alcanzado'];

function apiCall(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.facebook.com',
      path,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${WA_TOKEN}` },
    };
    const req = https.request(options, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch { resolve(buf); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  if (!WA_TOKEN || !WABA_ID) {
    console.error('Uso: railway run --service n8n node check-wa-templates.js');
    console.error('  O: node check-wa-templates.js <TOKEN> <WABA_ID>');
    process.exit(1);
  }

  const data = await apiCall(`/v21.0/${WABA_ID}/message_templates?fields=name,status,id&limit=50`);
  if (data.error) {
    console.error('Error API:', JSON.stringify(data.error));
    process.exit(1);
  }

  const all = data.data || [];
  const veta = all.filter(t => NAMES.includes(t.name));

  if (!veta.length) {
    console.log('No se encontraron las plantillas VETA. ¿Ejecutaste create-wa-templates.js?');
    return;
  }

  let allOk = true;
  for (const t of veta) {
    const icon = t.status === 'APPROVED' ? '✅' : t.status === 'PENDING' ? '⏳' : '❌';
    console.log(`${icon} ${t.name} — ${t.status}`);
    if (t.status !== 'APPROVED') allOk = false;
  }

  const missing = NAMES.filter(n => !veta.find(t => t.name === n));
  if (missing.length) {
    console.log('\n⚠️  Plantillas faltantes:', missing.join(', '));
    console.log('Vuelve a ejecutar create-wa-templates.js para las que faltan.');
    return;
  }

  if (allOk) {
    console.log('\n✅ Todas aprobadas. Ejecuta en orden:');
    console.log('   1. node deploy-template-notifs.js');
    console.log('   2. node deploy-n8n-chat.js');
    console.log('   3. railway redeploy --service n8n --yes');
  } else {
    console.log('\nEspera unos minutos y vuelve a ejecutar este script.');
  }
}

main().catch(console.error);
