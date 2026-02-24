// Test standalone — Bloc 3 : Schéma digital & Santé technique
// Même logique que les routes Next.js, sans dépendance au serveur
// Usage : node test-bloc3.js [destination]
// Exemple : node test-bloc3.js "Annecy"

const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

// ─── Config ───────────────────────────────────────────────────────────────────

const DESTINATION = process.argv[2] || 'Annecy'

const DATAFORSEO_URL        = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced'
const DATAFORSEO_DOMAIN_URL = 'https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live'
const HALOSCAN_URL          = 'https://api.haloscan.com/api/domains/overview'
const PAGESPEED_URL         = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const OPENAI_URL            = 'https://api.openai.com/v1/chat/completions'

// Auth DataForSEO via objet axios
const dataForSEOAuth = {
  username: process.env.DATAFORSEO_LOGIN,
  password: process.env.DATAFORSEO_PASSWORD,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(etape, data) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`▶  ${etape}`)
  console.log('─'.repeat(60))
  console.log(JSON.stringify(data, null, 2))
}

/**
 * Extrait les résultats organiques depuis une liste d'items DataForSEO.
 * ⚠️ Ne jamais utiliser d'index fixe — itérer sur tous les items.
 */
function extraireOrganiques(items, requete_source, limite) {
  return (items ?? [])
    .filter((item) => item.type === 'organic')
    .slice(0, limite)
    .map((item) => ({
      position: item.rank_absolute ?? 0,
      url: item.url ?? '',
      domaine: item.domain ?? '',
      titre: item.title ?? '',
      meta_description: item.description ?? '',
      requete_source,
    }))
}

/**
 * Fusionne N listes SERP et déduplique par domaine (meilleure position conservée).
 */
function fusionnerTous(listes) {
  const parDomaine = new Map()
  for (const item of listes.flat()) {
    if (!item.domaine) continue
    const existant = parDomaine.get(item.domaine)
    if (!existant || item.position < existant.position) {
      parDomaine.set(item.domaine, item)
    }
  }
  return Array.from(parDomaine.values()).sort((a, b) => a.position - b.position)
}

// ─── Module SERP ──────────────────────────────────────────────────────────────

async function testerSERP() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  MODULE SERP — DataForSEO Organique (5 requêtes)')
  console.log('═'.repeat(60))

  const requetes = [
    { cle: 'destination',  keyword: DESTINATION },
    { cle: 'tourisme',     keyword: `${DESTINATION} tourisme` },
    { cle: 'hebergement',  keyword: `hébergement ${DESTINATION}` },
    { cle: 'que_faire',    keyword: `que faire ${DESTINATION}` },
    { cle: 'restaurant',   keyword: `restaurant ${DESTINATION}` },
  ]

  console.log(`\n⏳ 5 appels en parallèle...`)

  const reponses = await Promise.all(
    requetes.map(({ cle, keyword }) =>
      axios
        .post(DATAFORSEO_URL, [{ keyword, language_code: 'fr', location_code: 2250, depth: 10 }], {
          auth: dataForSEOAuth,
          timeout: 60000,
        })
        .then((res) => {
          const items = res.data.tasks?.[0]?.result?.[0]?.items ?? []
          const top3 = extraireOrganiques(items, cle, 3)
          console.log(`  "${keyword}" : ${top3.length} résultats`)
          return { requete: cle, keyword, top3 }
        })
        .catch((err) => {
          console.error(`  ✗ Erreur "${keyword}" :`, err.message)
          return { requete: cle, keyword, top3: [] }
        })
    )
  )

  const tous_resultats = fusionnerTous(reponses.map((r) => r.top3))
  console.log(`\n  Après fusion/déduplication : ${tous_resultats.length} domaines uniques`)

  log('Top domaines fusionnés', tous_resultats.map((r) => `${r.position}. ${r.domaine} [${r.requete_source}]`))
  log('Par intention (top 3)', reponses.map((r) => ({
    requete: r.requete,
    keyword: r.keyword,
    top3: r.top3.map((i) => i.domaine),
  })))

  return { par_requete: reponses, tous_resultats }
}

// ─── Module Classification ────────────────────────────────────────────────────

async function testerClassification(tous_resultats, par_requete) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  MODULE CLASSIFICATION — OpenAI GPT-4o-mini')
  console.log('═'.repeat(60))

  // Tronquer les champs pour réduire la taille du prompt
  const resumeTous = tous_resultats.map((r) => ({
    domaine: r.domaine,
    titre: r.titre.slice(0, 80),
    meta_description: r.meta_description.slice(0, 100),
  }))

  // Résumé compact des top 3 par intention
  const resumeParIntention = par_requete
    .map((r) => {
      const ligne = r.top3.map((item, i) => `${i + 1}. ${item.domaine}`).join(' | ')
      return `"${r.keyword}" : ${ligne || '(aucun résultat)'}`
    })
    .join('\n')

  const promptUtilisateur = `Destination auditée : ${DESTINATION}

RÉSULTATS PAR INTENTION DE RECHERCHE (top 3 par requête) :
${resumeParIntention}

TOUS LES DOMAINES À CLASSIFIER :
${JSON.stringify(resumeTous, null, 2)}

Catégories :
- officiel_ot : site de l'office de tourisme de la destination
- officiel_mairie : site de la mairie ou de la collectivité territoriale
- officiel_autre : CDT, région, autre institutionnel lié à la destination
- ota : plateformes de réservation (Booking, TripAdvisor, Airbnb, Expedia, Gîtes de France...)
- media : presse, blogs, guides (Routard, Petit Futé, Lonely Planet...)
- autre : tout le reste

Réponds avec ce JSON exact :
{
  "resultats_classes": [
    { "domaine": "lac-annecy.com", "categorie": "officiel_ot", "titre": "...", "meta_description": "..." }
  ],
  "top3_officiels": [
    { "domaine": "lac-annecy.com", "categorie": "officiel_ot", "titre": "...", "meta_description": "...", "position_serp": 1 }
  ],
  "domaine_ot": "lac-annecy.com",
  "visibilite_ot_par_intention": {
    "destination":  { "position": 1, "categorie_pos1": "officiel_ot" },
    "tourisme":     { "position": 1, "categorie_pos1": "officiel_ot" },
    "hebergement":  { "position": null, "categorie_pos1": "ota" },
    "que_faire":    { "position": null, "categorie_pos1": "media" },
    "restaurant":   { "position": null, "categorie_pos1": "ota" }
  },
  "score_visibilite_ot": 2
}

⚠️ score_visibilite_ot = nombre d'intentions où un site officiel_ est EN POSITION 1 (0 à 5)
⚠️ visibilite_ot_par_intention.position = position du premier site officiel_ dans la requête (null si absent du top 3)
⚠️ visibilite_ot_par_intention.categorie_pos1 = catégorie du site réellement en position 1
⚠️ top3_officiels = uniquement les résultats dont la catégorie commence par "officiel_"`

  try {
    const response = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Tu es expert en marketing digital touristique français. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.',
          },
          { role: 'user', content: promptUtilisateur },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    )

    const brut = response.data.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())

    log('Domaine OT détecté', parsed.domaine_ot)
    log('Score visibilité OT', `${parsed.score_visibilite_ot ?? 0}/5 intentions`)
    log('Visibilité par intention', parsed.visibilite_ot_par_intention)
    log('Top 3 officiels', parsed.top3_officiels)

    return {
      resultats_classes: parsed.resultats_classes ?? [],
      top3_officiels: (parsed.top3_officiels ?? []).filter((s) => s.categorie?.startsWith('officiel_')),
      domaine_ot: parsed.domaine_ot ?? null,
      visibilite_ot_par_intention: parsed.visibilite_ot_par_intention ?? {},
      score_visibilite_ot: parsed.score_visibilite_ot ?? 0,
    }
  } catch (err) {
    console.error('  ✗ Erreur Classification :', err.message)
    return { resultats_classes: [], top3_officiels: [], domaine_ot: null, visibilite_ot_par_intention: {}, score_visibilite_ot: 0 }
  }
}

// ─── Module Analyse OT ────────────────────────────────────────────────────────

async function testerAnalyseOT(domaine_ot, siteOT, url_ot) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  MODULE ANALYSE OT — OpenAI GPT-4o-mini')
  console.log('═'.repeat(60))
  console.log(`\n  Domaine : ${domaine_ot}`)

  const promptUtilisateur = `Site officiel de l'office de tourisme de ${DESTINATION} :
URL : ${url_ot || 'https://' + domaine_ot}
Titre : ${siteOT?.titre ?? '(non disponible)'}
Description : ${siteOT?.meta_description ?? '(non disponible)'}

À partir de ces informations, identifie les fonctionnalités probables du site.

JSON attendu :
{
  "fonctionnalites_detectees": {
    "moteur_reservation": true,
    "blog_actualites": true,
    "newsletter": "incertain",
    "agenda_evenements": true,
    "carte_interactive": "incertain",
    "application_mobile": false
  },
  "niveau_maturite_digital": "avance",
  "commentaire": "1-2 phrases sur la maturité digitale observable"
}`

  try {
    const response = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: "Tu es expert en marketing digital pour les offices de tourisme français. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.",
          },
          { role: 'user', content: promptUtilisateur },
        ],
        temperature: 0.1,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    )

    const brut = response.data.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
    log('Analyse site OT', parsed)
    return parsed
  } catch (err) {
    console.error('  ✗ Erreur Analyse OT :', err.message)
    return null
  }
}

// ─── Module SEO (Haloscan + fallback DataForSEO) ─────────────────────────────
// Architecture miroir de l'orchestrateur : un appel Haloscan par domaine,
// fallback DataForSEO si donnees_valides: false.

// ── Haloscan (domaine nu + retry www) ──

async function appelHaloscanDomaine(domaine) {
  const response = await axios.post(
    HALOSCAN_URL,
    { input: domaine, mode: 'domain', requested_data: ['metrics', 'best_keywords', 'best_pages'] },
    { headers: { 'haloscan-api-key': process.env.HALOSCAN_API_KEY }, timeout: 30000 }
  )
  // ⚠️ Niveau intermédiaire obligatoire : metrics.stats (validé sur réponse réelle www.lac-annecy.com)
  const metrics = response.data.metrics?.stats ?? {}
  const estVide =
    (response.data.metrics?.failure_reason !== null && response.data.metrics?.failure_reason !== undefined) ||
    (!metrics.total_keyword_count && !metrics.total_traffic)
  if (estVide) return { donnees_valides: false }
  return {
    donnees_valides: true,
    resultat: {
      domaine,
      total_keywords: metrics.total_keyword_count ?? 0,
      total_traffic: metrics.total_traffic ?? 0,
      top_3_positions: metrics.top_3_positions ?? 0,
      top_10_positions: metrics.top_10_positions ?? 0,
      visibility_index: metrics.visibility_index ?? 0,
      // traffic_value retourne "NA" (string) dans Haloscan — normalisation en 0
      traffic_value: typeof metrics.traffic_value === 'number' ? metrics.traffic_value : 0,
      site_non_indexe: false,
      source: 'haloscan',
    },
  }
}

async function appelHaloscan(domaine) {
  // Tentative 1 — domaine nu
  try {
    const res1 = await appelHaloscanDomaine(domaine)
    if (res1.donnees_valides) { console.log(`    ✓ Haloscan (nu)`); return res1 }
  } catch (err) { console.warn(`    ⚠ Haloscan nu : ${err.message}`) }

  // Tentative 2 — retry www.
  if (!domaine.startsWith('www.')) {
    const domaineWww = `www.${domaine}`
    console.warn(`    → retry Haloscan ${domaineWww}`)
    try {
      const res2 = await appelHaloscanDomaine(domaineWww)
      if (res2.donnees_valides) {
        console.log(`    ✓ Haloscan (www)`)
        return { donnees_valides: true, resultat: { ...res2.resultat, domaine } }
      }
    } catch (err) { console.warn(`    ⚠ Haloscan www : ${err.message}`) }
  }

  console.warn(`    → Haloscan : aucune donnée`)
  return { donnees_valides: false }
}

// ── DataForSEO domain_rank_overview (domaine nu + retry www) ──
// ⚠️ Chemin validé : tasks[0].result[0].items[0].metrics.organic (niveau items intermédiaire)

async function appelDataForSEOBrut(target) {
  const response = await axios.post(
    DATAFORSEO_DOMAIN_URL,
    [{ target, location_code: 2250, language_code: 'fr' }],
    { auth: dataForSEOAuth, timeout: 30000 }
  )
  // ⚠️ items[0] obligatoire — différent du chemin tasks[0].result[0].metrics
  const organic = response.data?.tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic
  if (!organic || !organic.count) return null
  return organic
}

async function appelDataForSEO(domaine) {
  function construireResultat(organic) {
    return {
      domaine,
      total_keywords: organic.count ?? 0,
      total_traffic: organic.estimated_traffic_monthly ?? 0,
      top_3_positions: organic.pos_1_3 ?? 0,
      top_10_positions: (organic.pos_1_3 ?? 0) + (organic.pos_4_10 ?? 0),
      visibility_index: organic.rank_absolute ?? 0,
      traffic_value: 0,
      site_non_indexe: false,
      source: 'dataforseo',
    }
  }

  // Tentative 1 — domaine nu
  try {
    const organic1 = await appelDataForSEOBrut(domaine)
    if (organic1) { console.log(`    ✓ DataForSEO (nu) count=${organic1.count}`); return construireResultat(organic1) }
  } catch (err) { console.warn(`    ⚠ DataForSEO nu : ${err.message}`) }

  // Tentative 2 — www. si pas déjà présent
  if (!domaine.startsWith('www.')) {
    const domaineWww = `www.${domaine}`
    console.warn(`    → DataForSEO count=0 → retry ${domaineWww}`)
    try {
      const organic2 = await appelDataForSEOBrut(domaineWww)
      if (organic2) { console.log(`    ✓ DataForSEO (www) count=${organic2.count}`); return construireResultat(organic2) }
    } catch (err) { console.warn(`    ⚠ DataForSEO www : ${err.message}`) }
  }

  return { domaine, total_keywords: 0, total_traffic: 0, top_3_positions: 0, top_10_positions: 0, visibility_index: 0, traffic_value: 0, site_non_indexe: true, source: 'dataforseo' }
}

// ── Orchestration SEO par domaine (miroir de lib/blocs/schema-digital.ts) ──

async function testerHaloscan(domaines) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  MODULE SEO — Haloscan + fallback DataForSEO')
  console.log('═'.repeat(60))

  const resultats = []
  const couts_seo = { haloscan: 0, dataforseo: 0 }

  for (const domaine of domaines) {
    console.log(`\n  → ${domaine}`)
    const haloscanRes = await appelHaloscan(domaine)
    couts_seo.haloscan++  // crédit consommé dans tous les cas

    if (haloscanRes.donnees_valides) {
      resultats.push(haloscanRes.resultat)
    } else {
      console.warn(`    → fallback DataForSEO domain_rank_overview`)
      const dfsRes = await appelDataForSEO(domaine)
      resultats.push(dfsRes)
      couts_seo.dataforseo++
    }
  }

  log('Scores SEO par domaine (source : haloscan / dataforseo)', resultats)
  return { resultats, couts_seo }
}

// ─── Module PageSpeed ─────────────────────────────────────────────────────────

async function testerPageSpeed(domaines) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  MODULE PAGESPEED — Core Web Vitals')
  console.log('═'.repeat(60))

  const resultats = await Promise.all(
    domaines.map(async (domaine) => {
      console.log(`\n  Appel PageSpeed → ${domaine}`)
      try {
        const params = (strategy) => ({
          url: `https://${domaine}`,
          strategy,
          key: process.env.PAGESPEED_API_KEY,
        })

        const [mobile, desktop] = await Promise.all([
          axios.get(PAGESPEED_URL, { params: params('mobile'), timeout: 45000 }),
          axios.get(PAGESPEED_URL, { params: params('desktop'), timeout: 45000 }),
        ])

        const extraire = (data) => ({
          score: Math.round((data.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
          lcp: Math.round(((data.lighthouseResult?.audits?.['largest-contentful-paint']?.numericValue ?? 0) / 1000) * 10) / 10,
          cls: Math.round((data.lighthouseResult?.audits?.['cumulative-layout-shift']?.numericValue ?? 0) * 100) / 100,
          inp: Math.round(data.lighthouseResult?.audits?.['interaction-to-next-paint']?.numericValue ?? 0),
        })

        return {
          domaine,
          mobile: extraire(mobile.data),
          desktop: extraire(desktop.data),
        }
      } catch (err) {
        console.error(`  ✗ Erreur PageSpeed ${domaine} :`, err.message)
        return { domaine, mobile: null, desktop: null, erreur: err.message }
      }
    })
  )

  log('Scores PageSpeed mobile + desktop par domaine', resultats)
  return resultats
}

// ─── Module OpenAI Synthèse ───────────────────────────────────────────────────

async function testerOpenAI(top3_officiels, haloscan, pagespeed, nb_officiels, nb_ota) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  MODULE OPENAI — Synthèse schéma digital')
  console.log('═'.repeat(60))

  const resumeTop3 = top3_officiels
    .map((s) => `  - ${s.domaine} (${s.categorie}) — position ${s.position_serp}`)
    .join('\n') || '  - Aucun site officiel identifié'

  const resumeHaloscan = haloscan
    .map((h) => h.site_non_indexe
      ? `${h.domaine} : non indexé`
      : `${h.domaine} : ${h.total_keywords.toLocaleString('fr-FR')} mots-clés, ${h.total_traffic.toLocaleString('fr-FR')} visites/mois`)
    .join('\n') || 'Données SEO non disponibles'

  const resumePageSpeed = pagespeed
    .map((p) => p.erreur || !p.mobile
      ? `${p.domaine} : erreur ou données indisponibles`
      : `${p.domaine} : mobile ${p.mobile.score}/100 (LCP ${p.mobile.lcp}s), desktop ${p.desktop.score}/100`)
    .join('\n') || 'Données techniques non disponibles'

  const promptUtilisateur = `Destination : ${DESTINATION}

SERP Google :
- ${nb_officiels} sites officiels dans les résultats
- ${nb_ota} plateformes OTA dans les résultats
- Top 3 officiels :
${resumeTop3}

Visibilité SEO (Haloscan) :
${resumeHaloscan}

Santé technique (PageSpeed) :
${resumePageSpeed}

Génère une analyse synthétique pour un rapport d'audit digital.

JSON attendu :
{
  "synthese_schema": "80-100 mots pour GDoc",
  "indicateurs_cles": ["constat 1", "constat 2", "constat 3"],
  "points_attention": ["point 1", "point 2"]
}`

  try {
    const response = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: "Tu es expert en audit digital pour les destinations touristiques françaises. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.",
          },
          { role: 'user', content: promptUtilisateur },
        ],
        temperature: 0.2,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    )

    const brut = response.data.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
    log('Synthèse OpenAI', parsed)
    return parsed
  } catch (err) {
    console.error('  ✗ Erreur OpenAI Synthèse :', err.message)
    return { synthese_schema: '', indicateurs_cles: [], points_attention: [] }
  }
}

// ─── Orchestration ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'█'.repeat(60)}`)
  console.log('  BLOC 3 — SCHÉMA DIGITAL & SANTÉ TECHNIQUE')
  console.log(`  Destination : ${DESTINATION}`)
  console.log('█'.repeat(60))

  const debut = Date.now()

  // Étape 1 : SERP (5 requêtes)
  console.log('\n⏳ Étape 1 — SERP Google (5 requêtes en parallèle)...')
  const { par_requete, tous_resultats } = await testerSERP()

  // Étape 2 : Classification OpenAI
  console.log('\n⏳ Étape 2 — Classification + visibilité par intention...')
  const { resultats_classes, top3_officiels, domaine_ot, visibilite_ot_par_intention, score_visibilite_ot } =
    await testerClassification(tous_resultats, par_requete)

  // Métriques SERP
  const nb_officiels = resultats_classes.filter((r) => r.categorie?.startsWith('officiel_')).length
  const nb_ota = resultats_classes.filter((r) => r.categorie === 'ota').length

  console.log(`\n  Sites officiels : ${nb_officiels}`)
  console.log(`  OTA : ${nb_ota}`)
  console.log(`  Domaine OT : ${domaine_ot ?? 'non trouvé'}`)
  console.log(`  Score visibilité OT : ${score_visibilite_ot}/5`)

  const top3_domaines = top3_officiels.map((s) => s.domaine)
  const siteOT = top3_officiels.find((s) => s.categorie === 'officiel_ot') ?? top3_officiels[0] ?? null
  const urlOT = domaine_ot ? (tous_resultats.find((r) => r.domaine === domaine_ot)?.url ?? '') : ''

  // Étape 3a : Haloscan séquentiel avec fallback DataForSEO
  let haloscan = []
  let couts_seo = { haloscan: 0, dataforseo: 0 }
  let pagespeed = []
  let analyse_ot = null

  if (top3_domaines.length) {
    console.log('\n⏳ Étape 3a — SEO : Haloscan + fallback DataForSEO (séquentiel)...')
    const seoRes = await testerHaloscan(top3_domaines)
    haloscan = seoRes.resultats
    couts_seo = seoRes.couts_seo
  }

  // Étape 3b : PageSpeed + Analyse OT en parallèle
  if (top3_domaines.length || domaine_ot) {
    console.log('\n⏳ Étape 3b — PageSpeed + Analyse OT (parallèle)...')
    ;[pagespeed, analyse_ot] = await Promise.all([
      top3_domaines.length ? testerPageSpeed(top3_domaines) : Promise.resolve([]),
      domaine_ot && siteOT ? testerAnalyseOT(domaine_ot, siteOT, urlOT) : Promise.resolve(null),
    ])
  }

  // Étape 4 : Synthèse OpenAI
  console.log('\n⏳ Étape 4 — Synthèse OpenAI...')
  const openai = await testerOpenAI(top3_officiels, haloscan, pagespeed, nb_officiels, nb_ota)

  // Coûts — couts_seo reflète les appels réels (crédits consommés même si vide)
  const coutDataForSEO    = 5 * 0.006
  const coutHaloscan      = couts_seo.haloscan * 0.01
  const coutDataForSEODom = couts_seo.dataforseo * 0.006
  const coutOpenAI        = (domaine_ot ? 3 : 2) * 0.001
  const coutTotal         = coutDataForSEO + coutHaloscan + coutDataForSEODom + coutOpenAI
  const duree              = ((Date.now() - debut) / 1000).toFixed(1)

  // Résultat final
  console.log(`\n${'█'.repeat(60)}`)
  console.log('  RÉSULTAT FINAL')
  console.log('█'.repeat(60))
  console.log(JSON.stringify({
    nb_domaines_uniques: tous_resultats.length,
    domaine_ot_detecte: domaine_ot,
    score_visibilite_ot: `${score_visibilite_ot}/5`,
    visibilite_ot_par_intention,
    top3_officiels,
    analyse_site_ot: analyse_ot,
    haloscan,
    pagespeed,
    openai,
    meta: {
      nb_sites_officiels: nb_officiels,
      nb_ota: nb_ota,
    },
    couts: {
      dataforseo_serp: `${coutDataForSEO.toFixed(3)} € (5 appels)`,
      haloscan: `${coutHaloscan.toFixed(3)} € (${couts_seo.haloscan} appels)`,
      dataforseo_domain: `${coutDataForSEODom.toFixed(3)} € (${couts_seo.dataforseo} appels fallback)`,
      openai: `${coutOpenAI.toFixed(3)} € (${domaine_ot ? 3 : 2} appels)`,
      total: `${coutTotal.toFixed(3)} €`,
    },
  }, null, 2))

  console.log(`\n✅ Terminé en ${duree}s — Coût estimé : ${coutTotal.toFixed(4)} €`)
}

main().catch((err) => {
  console.error('\n✗ Erreur fatale :', err.message)
  process.exit(1)
})
