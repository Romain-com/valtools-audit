// Test end-to-end — Bloc 1 : Positionnement & Notoriété
// Destination : Trévoux (code INSEE 01390)
// Flux complet avec vraies APIs uniquement — aucune donnée simulée

const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

// ─── Config ──────────────────────────────────────────────────────────────────

const DESTINATION = 'Trévoux'
const HASHTAG     = 'trevoux'
const CODE_INSEE  = '01427'

const DATAFORSEO_URL = 'https://api.dataforseo.com/v3/serp/google/maps/live/advanced'
const OPENAI_URL     = 'https://api.openai.com/v1/chat/completions'

const auth = Buffer.from(
  `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
).toString('base64')

const API_COSTS = {
  dataforseo_maps:       0.006,
  apify_hashtag_stats:   0.05,
  apify_hashtag_scraper: 0.05,
  openai_gpt4o_mini:     0.001,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(etape, data) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`▶  ${etape}`)
  console.log('─'.repeat(60))
  console.log(JSON.stringify(data, null, 2))
}

function urlApify(acteur, timeoutSec = 90) {
  return (
    `https://api.apify.com/v2/acts/${acteur}/run-sync-get-dataset-items` +
    `?token=${process.env.APIFY_API_TOKEN}&timeout=${timeoutSec}`
  )
}

function extrairePremiereFiche(task) {
  const items = task.result?.[0]?.items ?? []
  const fiche =
    items.find((i) => i.type === 'organic') ??
    items.find((i) => i.title) ??
    items[0]
  if (!fiche?.title) return null
  return {
    nom:     fiche.title,
    note:    fiche.rating?.value ?? 0,
    avis:    fiche.rating?.votes_count ?? 0,
    adresse: fiche.address ?? '',
  }
}

function estCompteOT(username, destination) {
  const u = username.toLowerCase()
  const d = destination.toLowerCase().replace(/\s+/g, '')
  return u.includes('tourisme') || u.includes('ot_') || u.includes(d)
}

// ─── Étape 0 : vérification du microservice DATA Tourisme ────────────────────

async function verifierMicroservice() {
  const apiUrl = process.env.DATA_TOURISME_API_URL
  try {
    await axios.get(`${apiUrl}/health`, { timeout: 3000 })
  } catch {
    // /health peut ne pas exister — on tente juste une connexion TCP via /poi
    try {
      await axios.get(`${apiUrl}/poi`, { timeout: 3000, params: { code_insee: '00000', limit: 1 } })
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        console.error('\n✗ Microservice DATA Tourisme injoignable.')
        console.error('  Lance d\'abord le microservice avec :')
        console.error('  cd microservice && npm run dev')
        console.error('  puis relance le test.\n')
        process.exit(1)
      }
      // Toute autre erreur (404, 500…) → le microservice tourne, on continue
    }
  }
}

// ─── Étape 1 : POI bruts depuis DATA Tourisme ────────────────────────────────

async function etapePOI() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  ÉTAPE 1 — POI (DATA Tourisme)')
  console.log('═'.repeat(60))

  const apiUrl = process.env.DATA_TOURISME_API_URL
  const r = await axios.get(`${apiUrl}/poi`, {
    params: { code_insee: CODE_INSEE, types: 'PointOfInterest,SportsAndLeisurePlace', limit: 10 },
    timeout: 10000,
  })
  const poi = Array.isArray(r.data) ? r.data : []
  log(`${poi.length} POI récupérés pour ${DESTINATION}`, poi)
  return poi
}

// ─── Étape 2 : sélection IA des 3 POI représentatifs ─────────────────────────

async function etapePoiSelection(poiListe) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  ÉTAPE 2 — POI-SÉLECTION (OpenAI)')
  console.log('═'.repeat(60))

  if (poiListe.length === 0) {
    console.log('  ℹ Liste POI vide → sélection ignorée')
    return []
  }

  const poiResume = poiListe.map((p) => ({
    nom:   p.nom ?? p['rdfs:label'] ?? 'Inconnu',
    types: p.types ?? [],
  }))

  const promptUser = `Destination touristique : ${DESTINATION}

Liste de POI disponibles (${poiListe.length} entrées) :
${JSON.stringify(poiResume, null, 2)}

Sélectionne les 3 POI les plus représentatifs et touristiquement pertinents pour ${DESTINATION}.
Réponds avec ce JSON exact :
{
  "poi_selectionnes": [
    { "nom": "nom exact du POI", "raison": "pourquoi ce POI est pertinent" },
    { "nom": "...", "raison": "..." },
    { "nom": "...", "raison": "..." }
  ]
}`

  const r = await axios.post(
    OPENAI_URL,
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Tu es un expert en tourisme français. Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires).' },
        { role: 'user', content: promptUser },
      ],
      temperature: 0.2,
      max_tokens: 200,
    },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 20000 }
  )

  const brut    = r.data.choices?.[0]?.message?.content ?? ''
  const parsed  = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
  const selects = parsed.poi_selectionnes ?? []
  log('POI sélectionnés par OpenAI', selects)
  return selects
}

// ─── Étape 3a : Maps (OT + 3 POI séquentiels) ────────────────────────────────

async function etapeMaps(poiSelectionnes) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  ÉTAPE 3a — MAPS (DataForSEO)')
  console.log('═'.repeat(60))

  // Appel 1 : OT
  let ficheOT = { absent: true }
  try {
    console.log(`\n[1/${1 + poiSelectionnes.length}] keyword = "Office de tourisme ${DESTINATION}"`)
    const r = await axios.post(
      DATAFORSEO_URL,
      [{ keyword: `Office de tourisme ${DESTINATION}`, language_name: 'French', location_name: 'France' }],
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, timeout: 60000 }
    )
    const fiche = extrairePremiereFiche(r.data.tasks?.[0] ?? {})
    if (fiche) ficheOT = fiche
    log('Fiche OT', ficheOT)
  } catch (err) {
    console.error('  ✗ Erreur OT :', err.message)
  }

  // Appels 2/3/4 : POI (séquentiels — contrainte DataForSEO)
  const fichesPOI = []
  for (let i = 0; i < Math.min(poiSelectionnes.length, 3); i++) {
    const poi = poiSelectionnes[i]
    try {
      console.log(`\n[${i + 2}/${1 + poiSelectionnes.length}] keyword = "${poi.nom}"`)
      const r = await axios.post(
        DATAFORSEO_URL,
        [{ keyword: poi.nom, language_name: 'French', location_name: 'France' }],
        { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, timeout: 60000 }
      )
      const fiche = extrairePremiereFiche(r.data.tasks?.[0] ?? {})
      fichesPOI.push(fiche ?? { absent: true })
      log(`Fiche POI "${poi.nom}"`, fiche ?? { absent: true })
    } catch (err) {
      console.error(`  ✗ Erreur POI "${poi.nom}" :`, err.message)
      fichesPOI.push({ absent: true })
    }
  }

  // Score de synthèse
  const notesPOI   = fichesPOI.filter((f) => !f.absent && f.note > 0).map((f) => f.note)
  const moyennePOI = notesPOI.length > 0 ? notesPOI.reduce((a, n) => a + n, 0) / notesPOI.length : 0
  const noteOT     = ficheOT.absent ? 0 : ficheOT.note

  let score
  if (moyennePOI > 0 && noteOT > 0) {
    score = Math.round((moyennePOI * 0.7 + noteOT * 0.3) * 10) / 10
  } else if (moyennePOI > 0) {
    score = Math.round(moyennePOI * 10) / 10
  } else {
    score = noteOT
  }

  const nbAppels = 1 + Math.min(poiSelectionnes.length, 3)
  const resultat = {
    ot: ficheOT, poi: fichesPOI, score_synthese: score,
    cout: { dataforseo: { nb_appels: nbAppels, cout_unitaire: API_COSTS.dataforseo_maps, cout_total: nbAppels * API_COSTS.dataforseo_maps } },
  }
  log('RÉSULTAT MAPS', resultat)
  return resultat
}

// ─── Étape 3b : Instagram ────────────────────────────────────────────────────

async function etapeInstagram() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  ÉTAPE 3b — INSTAGRAM (Apify)')
  console.log('═'.repeat(60))

  let postsCount   = null
  let postsRecents = []

  try {
    console.log(`\n[1/2] hashtag-stats → #${HASHTAG}`)
    const r = await axios.post(
      urlApify('apify~instagram-hashtag-stats'),
      { hashtags: [HASHTAG], maxItems: 1 },
      { timeout: 120000 }
    )
    const data = r.data?.[0]
    postsCount = data?.postsCount ?? data?.mediaCount ?? null
    console.log(`  postsCount = ${postsCount?.toLocaleString('fr-FR') ?? 'null'}`)
  } catch (err) {
    console.error('  ✗ Erreur hashtag-stats :', err.message)
  }

  try {
    console.log(`\n[2/2] hashtag-scraper → #${HASHTAG} (10 posts)`)
    const r = await axios.post(
      urlApify('apify~instagram-hashtag-scraper'),
      { hashtags: [HASHTAG], resultsLimit: 10 },
      { timeout: 120000 }
    )
    postsRecents = (r.data ?? []).map((item) => ({
      likes:     item.likesCount ?? 0,
      username:  item.ownerUsername ?? '',
      timestamp: item.timestamp ?? '',
      caption:   (item.caption ?? '').slice(0, 80),
    }))
    console.log(`  ${postsRecents.length} posts récupérés`)
  } catch (err) {
    console.error('  ✗ Erreur hashtag-scraper :', err.message)
  }

  const nbOT  = postsRecents.filter((p) => estCompteOT(p.username, HASHTAG)).length
  const resultat = {
    hashtag: HASHTAG, posts_count: postsCount, posts_recents: postsRecents,
    ratio_ot_ugc: `${nbOT}/${postsRecents.length}`,
    cout: { nb_appels: 2, cout_unitaire: API_COSTS.apify_hashtag_stats, cout_total: 2 * API_COSTS.apify_hashtag_stats },
  }
  log('RÉSULTAT INSTAGRAM', resultat)
  return resultat
}

// ─── Étape 4 : Analyse OpenAI finale ─────────────────────────────────────────

async function etapeOpenAI(google, instagram) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  ÉTAPE 4 — ANALYSE OPENAI')
  console.log('═'.repeat(60))

  const ficheOT = google.ot.absent
    ? 'Aucune fiche OT trouvée sur Google Maps.'
    : `Note OT : ${google.ot.note}/5 (${google.ot.avis} avis) — ${google.ot.nom}`

  const poiNotes = (google.poi ?? [])
    .filter((f) => !f.absent && f.note > 0)
    .map((f) => `${f.nom} : ${f.note}/5 (${f.avis} avis)`)
    .join(', ')

  const resumeInstagram = instagram.posts_count
    ? `${instagram.posts_count.toLocaleString('fr-FR')} posts pour #${instagram.hashtag}, ratio OT/UGC : ${instagram.ratio_ot_ugc}`
    : `Données Instagram partielles pour #${instagram.hashtag}`

  const exemplesPostsRecents = instagram.posts_recents
    .slice(0, 5)
    .map((p, i) => `  ${i + 1}. @${p.username} (${p.likes} likes) : "${p.caption}"`)
    .join('\n')

  const promptUser = `Destination touristique : ${DESTINATION}

DONNÉES GOOGLE MAPS :
- ${ficheOT}
${poiNotes ? `- POI phares : ${poiNotes}` : ''}
- Score de synthèse : ${google.score_synthese}/5

DONNÉES INSTAGRAM :
- ${resumeInstagram}
${exemplesPostsRecents ? `\nExemples de posts récents :\n${exemplesPostsRecents}` : ''}

Sur la base de ces données, génère l'analyse marketing suivante en JSON valide :
{
  "axe_principal": "une phrase résumant le positionnement perçu de la destination",
  "mots_cles": ["mot1", "mot2", "mot3"],
  "forces_faiblesses": {
    "forces": ["force 1", "force 2"],
    "faiblesses": ["faiblesse 1", "faiblesse 2"]
  },
  "paragraphe_gdoc": "paragraphe rédigé de 80 à 100 mots, prêt à coller dans un rapport Google Docs, en français"
}`

  const r = await axios.post(
    OPENAI_URL,
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: "Tu es un expert en marketing touristique français. Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires)." },
        { role: 'user', content: promptUser },
      ],
      temperature: 0.2,
      max_tokens: 400,
    },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
  )

  const brut   = r.data.choices?.[0]?.message?.content ?? ''
  const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
  const resultat = { ...parsed, cout: { nb_appels: 1, cout_unitaire: API_COSTS.openai_gpt4o_mini, cout_total: API_COSTS.openai_gpt4o_mini } }
  log('RÉSULTAT OPENAI', resultat)
  return resultat
}

// ─── Orchestration ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'█'.repeat(60)}`)
  console.log(`  AUDIT DIGITAL — BLOC 1`)
  console.log(`  Destination : ${DESTINATION}  |  Code INSEE : ${CODE_INSEE}  |  #${HASHTAG}`)
  console.log('█'.repeat(60))

  const debut = Date.now()

  // Vérification du microservice avant de commencer
  await verifierMicroservice()

  // Étape 1 : POI bruts
  const poiListe = await etapePOI()

  // Étape 2 : sélection IA
  const poiSelectionnes = await etapePoiSelection(poiListe)

  // Étape 3 : Maps + Instagram en parallèle
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  ÉTAPES 3a & 3b — Maps + Instagram (parallèle)')
  console.log('═'.repeat(60))
  const [google, instagram] = await Promise.all([
    etapeMaps(poiSelectionnes),
    etapeInstagram(),
  ])

  // Étape 4 : analyse finale
  const positionnement = await etapeOpenAI(google, instagram)

  // Agrégation des coûts
  const nbMapsAppels = 1 + Math.min(poiSelectionnes.length, 3)
  const couts_bloc = {
    dataforseo: { nb_appels: nbMapsAppels, cout_unitaire: API_COSTS.dataforseo_maps, cout_total: nbMapsAppels * API_COSTS.dataforseo_maps },
    apify:      { nb_appels: 2, cout_unitaire: API_COSTS.apify_hashtag_stats, cout_total: 2 * API_COSTS.apify_hashtag_stats },
    openai:     { nb_appels: 2, cout_unitaire: API_COSTS.openai_gpt4o_mini,   cout_total: 2 * API_COSTS.openai_gpt4o_mini   },
    total_bloc: nbMapsAppels * API_COSTS.dataforseo_maps + 2 * API_COSTS.apify_hashtag_stats + 2 * API_COSTS.openai_gpt4o_mini,
  }

  console.log(`\n${'█'.repeat(60)}`)
  console.log('  RÉSULTAT FINAL AGRÉGÉ')
  console.log('█'.repeat(60))
  console.log(JSON.stringify({ google, instagram, positionnement, couts_bloc }, null, 2))

  const duree = ((Date.now() - debut) / 1000).toFixed(1)
  console.log(`\n✅ Terminé en ${duree}s — Coût estimé : ${couts_bloc.total_bloc.toFixed(4)} €`)
}

main().catch((err) => {
  console.error('\n✗ Erreur fatale :', err.message)
  process.exit(1)
})
