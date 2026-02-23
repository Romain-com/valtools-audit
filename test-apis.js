require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

const DESTINATION = 'Annecy';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function header(n, total, name) {
  console.log(`\n[${n}/${total}] ${name}...`);
}

function ok(msg) {
  console.log(`✅ OK — ${msg}`);
}

function err(label, e) {
  console.log(`❌ ERREUR — ${label}`);
  if (e.response) {
    console.log(`   Status  : ${e.response.status} ${e.response.statusText}`);
    console.log(`   Body    : ${JSON.stringify(e.response.data).slice(0, 400)}`);
  } else {
    console.log(`   Message : ${e.message}`);
  }
}

function truncate(str, max = 80) {
  return str && str.length > max ? str.slice(0, max) + '…' : str;
}

const results = [];
function record(name, success) {
  results.push({ name, success });
}

// ─── 1. data.gouv.fr — Géo API ────────────────────────────────────────────────

async function testGeoGouv() {
  header(1, 7, 'data.gouv.fr (Géo API)');
  try {
    const { data } = await axios.get(
      'https://geo.api.gouv.fr/communes',
      {
        params: {
          nom: DESTINATION,
          fields: 'nom,code,codesPostaux,codeDepartement,codeRegion,population',
          format: 'json',
          limit: 3,
        },
        timeout: 30000,
      }
    );

    if (!Array.isArray(data) || data.length === 0) throw new Error('Réponse vide');
    const c = data[0];
    ok(`${c.nom} trouvée : code ${c.code}, population ${c.population?.toLocaleString('fr')}, dept ${c.codeDepartement}`);
    data.forEach((commune, i) => {
      console.log(`  #${i + 1} : ${commune.nom} (${commune.code}) — pop. ${commune.population?.toLocaleString('fr')}`);
    });
    record('data.gouv.fr (Géo API)', true);
  } catch (e) {
    err('data.gouv.fr', e);
    record('data.gouv.fr (Géo API)', false);
  }
}

// ─── 2. DataForSEO — SERP Google ──────────────────────────────────────────────

async function testDataForSEO() {
  header(2, 7, 'DataForSEO SERP');
  try {
    const login    = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;
    if (!login || !password) throw new Error('DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD manquants');

    const { data } = await axios.post(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
      [
        {
          keyword: `${DESTINATION} tourisme`,
          language_code: 'fr',
          location_code: 2250,
          depth: 10,
        },
      ],
      {
        auth: { username: login, password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    const task = data.tasks?.[0];
    if (!task || task.status_code !== 20000) {
      throw new Error(`status_code ${task?.status_code} — ${task?.status_message}`);
    }

    const items = task.result?.[0]?.items?.filter(i => i.type === 'organic') ?? [];
    ok(`${items.length} résultats organiques retournés`);
    items.slice(0, 5).forEach((item, i) => {
      console.log(`  #${i + 1} : ${item.url}`);
      console.log(`       "${truncate(item.title)}"`);
    });
    record('DataForSEO SERP', true);
  } catch (e) {
    err('DataForSEO', e);
    record('DataForSEO SERP', false);
  }
}

// ─── 3. OpenAI — Positionnement ───────────────────────────────────────────────

async function testOpenAI() {
  header(3, 7, 'OpenAI Positionnement');
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY manquant');

    const prompt = `Tu es un expert en marketing territorial. Analyse le positionnement marketing touristique de "${DESTINATION}" en France.

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires) de cette forme :
{
  "axes_principaux": ["axe1", "axe2"],
  "axes_secondaires": ["axe3"],
  "resume_positioning": "Résumé en 2 phrases.",
  "confiance": 0.9
}

Axes disponibles : Nature/Montagne, Mer/Littoral, Campagne/Rural, Patrimoine/Culture/Histoire, Gastronomie/Terroir, Sports&Aventure, Bien-être/Slow travel, Famille, Luxe, Lac/Eau douce.`;

    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const raw = data.choices?.[0]?.message?.content ?? '';
    const json = JSON.parse(raw.replace(/```json\n?|```/g, '').trim());

    ok('Positionnement détecté :');
    console.log(`  Axes principaux  : ${json.axes_principaux?.join(', ')}`);
    console.log(`  Axes secondaires : ${json.axes_secondaires?.join(', ')}`);
    console.log(`  Résumé           : ${json.resume_positioning}`);
    console.log(`  Confiance        : ${json.confiance}`);
    record('OpenAI Positionnement', true);
  } catch (e) {
    err('OpenAI', e);
    record('OpenAI Positionnement', false);
  }
}

// ─── 4. DataForSEO — Google Maps ─────────────────────────────────────────────

async function testDataForSEOMaps() {
  header(4, 7, 'DataForSEO Google Maps');
  try {
    const login    = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;
    if (!login || !password) throw new Error('DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD manquants');

    const { data } = await axios.post(
      'https://api.dataforseo.com/v3/serp/google/maps/live/advanced',
      [
        {
          keyword: `Office de tourisme ${DESTINATION}`,
          language_code: 'fr',
          location_code: 2250,
          depth: 10,
        },
      ],
      {
        auth: { username: login, password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
      }
    );

    const places = [];
    for (const task of data.tasks ?? []) {
      if (task.status_code !== 20000) {
        throw new Error(`status_code ${task.status_code} — ${task.status_message}`);
      }
      for (const result of task.result ?? []) {
        for (const item of result.items ?? []) {
          if (item.type === 'maps_search') places.push(item);
        }
      }
    }

    if (places.length === 0) throw new Error('Aucune fiche retournée');

    ok(`${places.length} fiche(s) Google Maps trouvée(s) :`);
    places.slice(0, 4).forEach(p => {
      const rating  = p.rating?.value ?? 'N/A';
      const reviews = p.rating?.votes_count?.toLocaleString('fr') ?? 'N/A';
      console.log(`  ${p.title} — Note ${rating} — ${reviews} avis`);
    });
    record('DataForSEO Google Maps', true);
  } catch (e) {
    err('DataForSEO Google Maps', e);
    record('DataForSEO Google Maps', false);
  }
}

// ─── 5. Apify — Instagram Hashtag ─────────────────────────────────────────────

async function testApifyInstagram() {
  header(5, 7, 'Apify Instagram Hashtag');
  try {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) throw new Error('APIFY_API_TOKEN manquant');

    const { data } = await axios.post(
      `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${token}&timeout=55`,
      {
        hashtags: [DESTINATION.toLowerCase()],
        resultsLimit: 5,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000,
      }
    );

    if (!Array.isArray(data) || data.length === 0) throw new Error('Aucun post retourné');

    // Le 1er item contient souvent les méta du hashtag
    const meta = data[0];
    const volume = meta.topPostsCount ?? meta.postsCount ?? meta.mediaCount ?? 'N/A';
    ok(`Hashtag #${DESTINATION.toLowerCase()} : ~${typeof volume === 'number' ? volume.toLocaleString('fr') : volume} posts`);

    data.slice(0, 3).forEach((post, i) => {
      const likes    = post.likesCount ?? post.likeCount ?? 'N/A';
      const owner    = post.ownerUsername ?? post.username ?? post.owner?.username ?? 'N/A';
      const shortcode = post.shortCode ?? post.id ?? '';
      console.log(`  Post #${i + 1} : @${owner} — ${typeof likes === 'number' ? likes.toLocaleString('fr') : likes} likes${shortcode ? ` (${shortcode})` : ''}`);
    });
    record('Apify Instagram', true);
  } catch (e) {
    err('Apify Instagram', e);
    record('Apify Instagram', false);
  }
}

// ─── 6. Monitorank ────────────────────────────────────────────────────────────

async function testMonitorank() {
  header(6, 7, 'Monitorank');
  try {
    const apiKey = process.env.MONITORANK_API_KEY;
    if (!apiKey) throw new Error('MONITORANK_API_KEY manquant');

    // Monitorank REST API — module=google&action=update retourne les mises à jour
    // d'algorithme Google, ce qui confirme que la clé est valide
    const { data } = await axios.get(
      'https://api.monitorank.com/',
      {
        params: { key: apiKey, module: 'google', action: 'update' },
        timeout: 60000,
      }
    );

    if (!data.result) throw new Error(data.error ?? 'Réponse invalide');

    const updates = Array.isArray(data.data) ? data.data : [];
    const last = updates[0];
    ok(`Accès confirmé — ${updates.length} mise(s) à jour Google référencée(s)`);
    if (last) {
      console.log(`  Dernière update : ${last.name} (${last.date})`);
    }
    record('Monitorank', true);
  } catch (e) {
    err('Monitorank', e);
    record('Monitorank', false);
  }
}

// ─── 7. Haloscan ──────────────────────────────────────────────────────────────

async function testHaloscan() {
  header(7, 7, 'Haloscan');
  try {
    const apiKey = process.env.HALOSCAN_API_KEY;
    if (!apiKey) throw new Error('HALOSCAN_API_KEY manquant');

    // /user/credit confirme l'authentification et retourne des données réelles
    const { data } = await axios.get(
      'https://api.haloscan.com/api/user/credit',
      {
        headers: { 'haloscan-api-key': apiKey },
        timeout: 30000,
      }
    );

    const total = data?.totalCredit ?? data;
    ok(`Accès confirmé — crédits disponibles :`);
    if (total && typeof total === 'object') {
      console.log(`  Crédits site     : ${(total.creditSite ?? 'N/A').toLocaleString?.() ?? total.creditSite}`);
      console.log(`  Crédits keyword  : ${(total.creditKeyword ?? 'N/A').toLocaleString?.() ?? total.creditKeyword}`);
      console.log(`  Crédits export   : ${(total.creditExport ?? 'N/A').toLocaleString?.() ?? total.creditExport}`);
    }
    record('Haloscan', true);
  } catch (e) {
    err('Haloscan', e);
    record('Haloscan', false);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('TEST APIs — Destination Digital Audit');
  console.log(`Destination de test : ${DESTINATION}`);
  console.log('='.repeat(60));

  // APIs rapides en parallèle (sans Apify qui peut être lent)
  await testGeoGouv();
  await testDataForSEO();
  await testOpenAI();
  await testMonitorank();
  await testHaloscan();

  await testDataForSEOMaps();
  await testApifyInstagram();

  // ─── Résumé ───────────────────────────────────────────────────────────────
  const total = results.length;
  const ok_count = results.filter(r => r.success).length;

  console.log('\n' + '='.repeat(60));
  console.log(`RÉSUMÉ : ${ok_count}/${total} APIs opérationnelles`);
  console.log('='.repeat(60));
  results.forEach(r => {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.name}`);
  });

  if (ok_count === total) {
    console.log('\n🎉 Toutes les APIs sont opérationnelles !');
  } else {
    console.log(`\n⚠️  ${total - ok_count} API(s) en erreur — vérifier les clés et endpoints ci-dessus.`);
  }
}

main().catch(e => {
  console.error('Erreur fatale :', e.message);
  process.exit(1);
});
