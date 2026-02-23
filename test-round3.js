/**
 * test-round3.js — RapidAPI Instagram : trouver postsCount du hashtag #annecy
 * Teste plusieurs APIs Instagram disponibles sur RapidAPI Hub.
 */

require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const HASHTAG = 'annecy';

const SEP  = '='.repeat(60);
const SEP2 = '-'.repeat(60);

function log(msg)  { console.log(msg); }
function ok(msg)   { console.log(`✅ ${msg}`); }
function warn(msg) { console.log(`⚠️  ${msg}`); }
function info(msg) { console.log(`   ${msg}`); }

// Champs cibles pour le volume du hashtag
const COUNT_FIELDS = [
  'media_count', 'postsCount', 'post_count', 'count', 'totalCount',
  'total_count', 'mediaCount', 'posts_count', 'edge_hashtag_to_media',
  'number_of_posts', 'tag_media_count', 'amount_of_posts'
];

function findCountField(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return null;
  for (const field of COUNT_FIELDS) {
    if (obj[field] !== undefined) return { field, value: obj[field] };
  }
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'object') {
      const found = findCountField(val, depth + 1);
      if (found) return { ...found, path: `${key}.${found.field ?? found.path}` };
    }
  }
  return null;
}

function showResult(label, data) {
  const found = findCountField(data);
  const raw = JSON.stringify(data).slice(0, 600);
  if (found) {
    ok(`${label} → champ trouvé : ${found.path ?? found.field} = ${JSON.stringify(found.value).slice(0, 100)}`);
  } else {
    warn(`${label} → aucun champ de volume trouvé`);
    info(`  Champs retournés : ${Object.keys(typeof data === 'object' && data !== null ? data : {}).join(', ')}`);
    info(`  Extrait : ${raw.slice(0, 300)}`);
  }
  return found;
}

async function get(url, params, host) {
  return axios.get(url, {
    params,
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': host,
    },
    timeout: 15000,
  });
}

async function post(url, body, host) {
  return axios.post(url, body, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': host,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

const results = [];

// ─────────────────────────────────────────────────────────────────────────────
// API 1 — instagram120 (celle du playground fourni par l'utilisateur)
// Host : instagram120.p.rapidapi.com
// ─────────────────────────────────────────────────────────────────────────────

async function testInstagram120() {
  log(`\n${SEP2}\nAPI 1 — instagram120.p.rapidapi.com\n${SEP2}`);
  const host = 'instagram120.p.rapidapi.com';

  const endpoints = [
    { path: '/v1/hashtag/', params: { name: HASHTAG } },
    { path: '/hashtag/',    params: { name: HASHTAG } },
    { path: '/v1/hashtag', params: { name: HASHTAG } },
    { path: '/hashtag',    params: { name: HASHTAG } },
    { path: '/v1/hashtag/', params: { hashtag: HASHTAG } },
    { path: '/v1/info/',    params: { hashtag: HASHTAG } },
    { path: '/v1/tags/',    params: { name: HASHTAG } },
    { path: '/tag/info/',   params: { name: HASHTAG } },
  ];

  let success = false;
  for (const ep of endpoints) {
    const url = `https://${host}${ep.path}`;
    try {
      const { data, status } = await get(url, ep.params, host);
      const label = `GET ${ep.path}?${new URLSearchParams(ep.params)}`;
      log(`  [${status}] ${label}`);
      const found = showResult(label, data);
      if (found) {
        results.push({ api: 'instagram120', endpoint: ep.path, field: found.path ?? found.field, value: found.value, success: true });
        success = true;
        break;
      }
    } catch (e) {
      const status = e.response?.status;
      if (status === 404) {
        info(`  [404] GET ${ep.path} — endpoint inexistant`);
      } else if (status === 401 || status === 403) {
        warn(`  [${status}] GET ${ep.path} — non autorisé (plan requis ?)`);
        break;
      } else if (status === 429) {
        warn(`  [429] Rate limit atteint`);
        break;
      } else {
        info(`  [${status ?? 'ERR'}] GET ${ep.path} — ${e.message.slice(0, 60)}`);
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!success) {
    warn('instagram120 — aucun endpoint hashtag trouvé avec ces paramètres');
    results.push({ api: 'instagram120', success: false });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API 2 — instagram-hashtags.p.rapidapi.com
// Endpoint connu : GET /?keyword=
// ─────────────────────────────────────────────────────────────────────────────

async function testInstagramHashtags() {
  log(`\n${SEP2}\nAPI 2 — instagram-hashtags.p.rapidapi.com\n${SEP2}`);
  const host = 'instagram-hashtags.p.rapidapi.com';

  const endpoints = [
    { path: '/',          params: { keyword: HASHTAG } },
    { path: '/hashtag',   params: { keyword: HASHTAG } },
    { path: '/info',      params: { keyword: HASHTAG } },
    { path: '/v1',        params: { keyword: HASHTAG } },
  ];

  let success = false;
  for (const ep of endpoints) {
    const url = `https://${host}${ep.path}`;
    try {
      const { data, status } = await get(url, ep.params, host);
      const label = `GET ${ep.path}?keyword=${HASHTAG}`;
      log(`  [${status}] ${label}`);
      const found = showResult(label, data);
      if (found) {
        results.push({ api: 'instagram-hashtags', endpoint: ep.path, field: found.path ?? found.field, value: found.value, success: true });
        success = true;
        break;
      } else if (status === 200) {
        // Retourne quelque chose mais pas le champ voulu — afficher quand même
        info(`  Réponse complète : ${JSON.stringify(data).slice(0, 400)}`);
      }
    } catch (e) {
      const status = e.response?.status;
      if (status === 404) info(`  [404] GET ${ep.path} — endpoint inexistant`);
      else if (status === 401 || status === 403) { warn(`  [${status}] Non autorisé`); break; }
      else if (status === 429) { warn(`  [429] Rate limit`); break; }
      else info(`  [${status ?? 'ERR'}] GET ${ep.path} — ${e.message.slice(0, 60)}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!success) {
    warn('instagram-hashtags — aucun champ de volume trouvé');
    results.push({ api: 'instagram-hashtags', success: false });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API 3 — instagram-scraper-api2.p.rapidapi.com
// API scraper populaire avec endpoint hashtag connu
// ─────────────────────────────────────────────────────────────────────────────

async function testInstagramScraperApi2() {
  log(`\n${SEP2}\nAPI 3 — instagram-scraper-api2.p.rapidapi.com\n${SEP2}`);
  const host = 'instagram-scraper-api2.p.rapidapi.com';

  const endpoints = [
    { path: '/v1/hashtag', params: { hashtag: HASHTAG } },
    { path: '/v1/tags',    params: { tag: HASHTAG } },
    { path: '/hashtag',    params: { hashtag: HASHTAG } },
  ];

  let success = false;
  for (const ep of endpoints) {
    const url = `https://${host}${ep.path}`;
    try {
      const { data, status } = await get(url, ep.params, host);
      const label = `GET ${ep.path}`;
      log(`  [${status}] ${label}`);
      const found = showResult(label, data);
      if (found) {
        results.push({ api: 'instagram-scraper-api2', endpoint: ep.path, field: found.path ?? found.field, value: found.value, success: true });
        success = true;
        break;
      } else if (status === 200) {
        info(`  Extrait : ${JSON.stringify(data).slice(0, 400)}`);
      }
    } catch (e) {
      const status = e.response?.status;
      if (status === 404) info(`  [404] GET ${ep.path} — inexistant`);
      else if (status === 401 || status === 403) { warn(`  [${status}] Non autorisé`); break; }
      else if (status === 429) { warn(`  [429] Rate limit`); break; }
      else info(`  [${status ?? 'ERR'}] — ${e.message.slice(0, 60)}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!success) results.push({ api: 'instagram-scraper-api2', success: false });
}

// ─────────────────────────────────────────────────────────────────────────────
// API 4 — instagram-data.p.rapidapi.com
// ─────────────────────────────────────────────────────────────────────────────

async function testInstagramData() {
  log(`\n${SEP2}\nAPI 4 — instagram-data.p.rapidapi.com\n${SEP2}`);
  const host = 'instagram-data.p.rapidapi.com';

  const endpoints = [
    { path: '/hashtag/info', params: { hashtag: HASHTAG } },
    { path: '/hashtag',      params: { hashtag: HASHTAG } },
    { path: '/v1/hashtag',   params: { hashtag: HASHTAG } },
    { path: '/tag',          params: { tag: HASHTAG } },
  ];

  let success = false;
  for (const ep of endpoints) {
    const url = `https://${host}${ep.path}`;
    try {
      const { data, status } = await get(url, ep.params, host);
      const label = `GET ${ep.path}`;
      log(`  [${status}] ${label}`);
      const found = showResult(label, data);
      if (found) {
        results.push({ api: 'instagram-data', endpoint: ep.path, field: found.path ?? found.field, value: found.value, success: true });
        success = true;
        break;
      } else if (status === 200) {
        info(`  Extrait : ${JSON.stringify(data).slice(0, 400)}`);
      }
    } catch (e) {
      const status = e.response?.status;
      if (status === 404) info(`  [404] GET ${ep.path} — inexistant`);
      else if (status === 401 || status === 403) { warn(`  [${status}] Non autorisé`); break; }
      else if (status === 429) { warn(`  [429] Rate limit`); break; }
      else info(`  [${status ?? 'ERR'}] — ${e.message.slice(0, 60)}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!success) results.push({ api: 'instagram-data', success: false });
}

// ─────────────────────────────────────────────────────────────────────────────
// API 5 — instagram-best-experience.p.rapidapi.com
// ─────────────────────────────────────────────────────────────────────────────

async function testInstagramBestExperience() {
  log(`\n${SEP2}\nAPI 5 — instagram-best-experience.p.rapidapi.com\n${SEP2}`);
  const host = 'instagram-best-experience.p.rapidapi.com';

  const endpoints = [
    { path: '/hashtag', params: { id: HASHTAG } },
    { path: '/hashtag', params: { hashtag: HASHTAG } },
    { path: '/v1/hashtag', params: { hashtag: HASHTAG } },
    { path: '/tag',     params: { tag: HASHTAG } },
  ];

  let success = false;
  for (const ep of endpoints) {
    const url = `https://${host}${ep.path}`;
    try {
      const { data, status } = await get(url, ep.params, host);
      const label = `GET ${ep.path}`;
      log(`  [${status}] ${label}`);
      const found = showResult(label, data);
      if (found) {
        results.push({ api: 'instagram-best-experience', endpoint: ep.path, field: found.path ?? found.field, value: found.value, success: true });
        success = true;
        break;
      } else if (status === 200) {
        info(`  Extrait : ${JSON.stringify(data).slice(0, 400)}`);
      }
    } catch (e) {
      const status = e.response?.status;
      if (status === 404) info(`  [404] GET ${ep.path} — inexistant`);
      else if (status === 401 || status === 403) { warn(`  [${status}] Non autorisé`); break; }
      else if (status === 429) { warn(`  [429] Rate limit`); break; }
      else info(`  [${status ?? 'ERR'}] — ${e.message.slice(0, 60)}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!success) results.push({ api: 'instagram-best-experience', success: false });
}

// ─────────────────────────────────────────────────────────────────────────────
// RÉSUMÉ
// ─────────────────────────────────────────────────────────────────────────────

function printSummary() {
  log(`\n\n${SEP}`);
  log('RÉSUMÉ — RapidAPI Instagram : postsCount du hashtag #annecy');
  log(SEP);

  const successes = results.filter(r => r.success);

  if (successes.length > 0) {
    ok(`${successes.length} API(s) retournent un volume de hashtag :`);
    successes.forEach(r => {
      const val = typeof r.value === 'object' ? JSON.stringify(r.value).slice(0, 80) : r.value;
      log(`\n  API     : ${r.api}`);
      log(`  Endpoint: ${r.endpoint}`);
      log(`  Champ   : ${r.field} = ${val}`);
    });
    log('\n');
    log('INTÉGRATION RECOMMANDÉE :');
    const best = successes[0];
    log(`  → Utiliser ${best.api}.p.rapidapi.com`);
    log(`  → Endpoint : GET ${best.endpoint}?hashtag=${HASHTAG}`);
    log(`  → Champ postsCount : response.${best.field}`);
    log(`  → Header : X-RapidAPI-Host: ${best.api}.p.rapidapi.com`);
  } else {
    warn('Aucune API RapidAPI testée ne retourne le volume total du hashtag.');
    log('');
    log('APIS TESTÉES :');
    results.forEach(r => log(`  ❌ ${r.api}`));
    log('');
    log('CONCLUSION :');
    log('  Le volume total d\'un hashtag Instagram (#annecy = "X millions de publications")');
    log('  n\'est plus accessible par scraping tiers depuis les changements');
    log('  d\'Instagram/Meta en 2023-2024 (durcissement des APIs privées).');
    log('');
    log('ALTERNATIVES POUR L\'AUDIT :');
    log('  1. Afficher le volume comme "N/A" avec note explicative');
    log('  2. Utiliser le nombre de posts récupérés (ex: "200+ posts/heure")');
    log('     comme proxy de l\'activité du hashtag');
    log('  3. Calculer l\'engagement moyen (likes+commentaires) des posts');
    log('     récupérés comme métrique de qualité');
    log('  4. Mentionner la valeur issue du hashtag dans l\'application');
    log('     Instagram directement (visible dans l\'app, pas via API)');
  }
  log(`\n${SEP}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  log(SEP);
  log('TEST Round 3 — RapidAPI Instagram postsCount');
  log(`Clé RapidAPI : ${RAPIDAPI_KEY ? RAPIDAPI_KEY.slice(0, 8) + '...' : '⚠️  MANQUANTE'}`);
  log(`Hashtag cible : #${HASHTAG}`);
  log(SEP);

  if (!RAPIDAPI_KEY) {
    warn('RAPIDAPI_KEY manquante dans .env.local — abandon');
    process.exit(1);
  }

  await testInstagram120();
  await testInstagramHashtags();
  await testInstagramScraperApi2();
  await testInstagramData();
  await testInstagramBestExperience();

  printSummary();
}

main().catch(e => {
  console.error('Erreur fatale :', e.message);
  process.exit(1);
});
