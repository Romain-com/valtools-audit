// Test DataForSEO PAA (People Also Ask) pour "les 7 laux"
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const AUTH = Buffer.from(
  `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
).toString('base64');

async function testPAA() {
  console.log('=== DataForSEO PAA — "les 7 laux" ===\n');

  try {
    const response = await axios.post(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
      [
        {
          keyword: 'les 7 laux',
          language_code: 'fr',
          location_code: 2250,
          depth: 10
        }
      ],
      {
        headers: {
          Authorization: `Basic ${AUTH}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const task = response.data?.tasks?.[0];
    console.log('Status code API :', response.data.status_code, response.data.status_message);
    console.log('Task status     :', task?.status_code, task?.status_message);
    console.log('Cost            :', task?.cost ?? 'N/A');
    console.log('');

    const allItems = task?.result?.[0]?.items ?? [];
    console.log(`Total items dans le SERP : ${allItems.length}`);

    // Types d'items présents
    const types = [...new Set(allItems.map(i => i.type))];
    console.log('Types présents           :', types.join(', '));
    console.log('');

    // ─── Filtrer les PAA ──────────────────────────────────────────
    const paaItems = allItems.filter(i => i.type === 'people_also_ask');
    console.log(`=== PAA items : ${paaItems.length} ===\n`);

    paaItems.forEach((item, idx) => {
      console.log(`--- PAA ${idx + 1} ---`);
      console.log('Question :', item.title ?? '(pas de titre)');

      const els = item.expanded_element ?? item.items ?? [];
      els.forEach((el, j) => {
        console.log(`  Réponse ${j + 1}`);
        if (el.type)        console.log('    type        :', el.type);
        if (el.featured_title) console.log('    featured    :', el.featured_title);
        if (el.description) console.log('    description :', el.description?.slice(0, 300));
        if (el.url)         console.log('    url         :', el.url);
        if (el.domain)      console.log('    domain      :', el.domain);
        if (el.title)       console.log('    title       :', el.title);
      });
      console.log('');
    });

    // ─── Dump brut complet pour inspection ───────────────────────
    console.log('\n=== Dump JSON brut de TOUS les items ===');
    console.log(JSON.stringify(allItems, null, 2));

  } catch (err) {
    if (err.response) {
      console.error('Erreur HTTP', err.response.status, JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Erreur :', err.message);
    }
  }
}

testPAA();
