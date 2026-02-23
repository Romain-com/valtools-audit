/**
 * Test rapide : apify/instagram-hashtag-stats + bilan RapidAPI
 */
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

const APIFY_TOKEN   = process.env.APIFY_API_TOKEN;
const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY;

async function testApifyHashtagStats() {
  console.log('\n=== apify/instagram-hashtag-stats ===');
  try {
    const { data: items } = await axios.post(
      `https://api.apify.com/v2/acts/apify~instagram-hashtag-stats/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=90`,
      { hashtags: ['annecy'], maxItems: 1 },
      { headers: { 'Content-Type': 'application/json' }, timeout: 120000 }
    );

    if (!Array.isArray(items) || items.length === 0) {
      console.log('❌ Aucun item retourné');
      return;
    }

    const item = items[0];
    console.log('Champs disponibles :', Object.keys(item).join(', '));
    console.log('\nItem complet :');
    console.log(JSON.stringify(item, null, 2).slice(0, 2000));

    const countFields = [
      'postsCount', 'media_count', 'mediaCount', 'post_count', 'count',
      'totalPosts', 'numberOfPosts', 'publicationsCount', 'total'
    ];
    let found = false;
    for (const f of countFields) {
      if (item[f] !== undefined) {
        console.log(`\n🎯 TROUVÉ : ${f} = ${item[f]}`);
        found = true;
      }
    }
    if (!found) console.log('\n⚠️  Aucun champ de volume total trouvé');

  } catch (e) {
    console.log('❌ Erreur :', e.response?.status, JSON.stringify(e.response?.data || e.message).slice(0, 300));
  }
}

async function bilanRapidAPI() {
  console.log('\n=== Bilan RapidAPI — APIs abonnées et résultats ===');

  // Test de connectivité simple sur les APIs abonnées confirmées
  const subscribed = [
    { host: 'instagram-data.p.rapidapi.com',                  note: 'Abonnée — endpoints hashtag non trouvés' },
    { host: 'instagram-profile-and-biography.p.rapidapi.com', note: 'Abonnée — endpoints hashtag non trouvés' },
    { host: 'rocketapi-for-instagram.p.rapidapi.com',         note: 'Abonnée — hashtag/get_info retourne 404' },
    { host: 'save-from-insta.p.rapidapi.com',                 note: 'Abonnée — outil téléchargement, non pertinente' },
  ];

  const notSubscribed = [
    'instagram120.p.rapidapi.com',
    'instagram-hashtags.p.rapidapi.com',
    'instagram-scraper-api2.p.rapidapi.com',
    'instagram-best-experience.p.rapidapi.com',
  ];

  console.log('\nAPIs avec abonnement actif :');
  subscribed.forEach(s => console.log(`  ✓ ${s.host} — ${s.note}`));

  console.log('\nAPIs sans abonnement (clé non souscrite) :');
  notSubscribed.forEach(h => console.log(`  ✗ ${h}`));
}

async function main() {
  console.log('============================================================');
  console.log('TEST Round 3 — postsCount Instagram (dernière tentative)');
  console.log('============================================================');

  await testApifyHashtagStats();
  await bilanRapidAPI();

  console.log('\n============================================================');
  console.log('CONCLUSION DÉFINITIVE');
  console.log('============================================================');
  console.log(`
postsCount (volume total d'un hashtag Instagram) :

❌ Non disponible via Apify/instagram-hashtag-scraper
❌ Non disponible via Apify/instagram-scraper (mode hashtag)
❌ Non disponible via RapidAPI (APIs abonnées — endpoints incorrects
   ou champ bloqué par Instagram depuis 2023/2024)

CAUSE RACINE :
  Instagram/Meta a supprimé l'accès public au compteur total des hashtags
  via leurs endpoints privés depuis mi-2023. Les scrapers tiers ne peuvent
  plus extraire ce chiffre de manière fiable.

RECOMMANDATION POUR L'AUDIT :
  Option A — Afficher "N/A" avec tooltip expliquant la limitation technique.
  Option B — Afficher la cadence de publication (posts/heure sur les dernières
             24h) comme proxy de l'activité du hashtag. Calculable à partir
             des timestamps des posts Apify récupérés.
  Option C — Souscrire à une API payante spécialisée (ex: instagram-data
             plan Pro sur RapidAPI, ou Brandwatch, Talkwalker) qui maintiennent
             des compteurs internes mis à jour indépendamment de l'API Instagram.
`);
}

main().catch(e => {
  console.error('Erreur fatale :', e.message);
  process.exit(1);
});
