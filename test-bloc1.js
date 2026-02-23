// Test standalone — Bloc 1 : Positionnement & Notoriété
// Même logique que les routes Next.js, sans dépendance au serveur
// Usage : node test-bloc1.js [destination] [hashtag]
// Exemple : node test-bloc1.js "Annecy" "annecy"

const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

// ─── Config ──────────────────────────────────────────────────────────────────

const DESTINATION = process.argv[2] || 'Annecy'
const HASHTAG     = process.argv[3] || 'annecy'

const DATAFORSEO_URL = 'https://api.dataforseo.com/v3/serp/google/maps/live/advanced'
const OPENAI_URL     = 'https://api.openai.com/v1/chat/completions'

const auth = Buffer.from(
  `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
).toString('base64')

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
  const fiche = items.find(
    (i) => i.type === 'maps_search' || i.type === 'local_pack' || i.type === 'google_maps'
  ) ?? items[0]
  if (!fiche || !fiche.title) return null
  return {
    nom: fiche.title,
    note: fiche.rating?.value ?? 0,
    avis: fiche.rating?.votes_count ?? 0,
    adresse: fiche.address ?? '',
  }
}

function estCompteOT(username, destination) {
  const u = username.toLowerCase()
  const d = destination.toLowerCase().replace(/\s+/g, '')
  return u.includes('tourisme') || u.includes('ot_') || u.includes(d)
}

// ─── Module Maps ─────────────────────────────────────────────────────────────

async function testerMaps() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  MODULE MAPS — DataForSEO')
  console.log('═'.repeat(60))

  let ficheDestination = { nom: DESTINATION, note: 0, avis: 0, adresse: '' }
  let ficheOT          = { absent: true }

  // Appel 1 : destination
  try {
    console.log(`\n[1/2] keyword = "${DESTINATION}"`)
    const r = await axios.post(
      DATAFORSEO_URL,
      [{ keyword: DESTINATION, language_name: 'French', location_name: 'France' }],
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, timeout: 60000 }
    )
    const task  = r.data.tasks?.[0]
    const fiche = extrairePremiereFiche(task)
    if (fiche) ficheDestination = fiche
    log('Fiche destination', ficheDestination)
  } catch (err) {
    console.error('  ✗ Erreur destination :', err.message)
  }

  // Appel 2 : OT
  try {
    const keyword = `Office de tourisme ${DESTINATION}`
    console.log(`\n[2/2] keyword = "${keyword}"`)
    const r = await axios.post(
      DATAFORSEO_URL,
      [{ keyword, language_name: 'French', location_name: 'France' }],
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, timeout: 60000 }
    )
    const task  = r.data.tasks?.[0]
    const fiche = extrairePremiereFiche(task)
    if (fiche) ficheOT = fiche
    log('Fiche OT', ficheOT)
  } catch (err) {
    console.error('  ✗ Erreur OT :', err.message)
  }

  // Score de synthèse
  const score = ficheOT.absent
    ? ficheDestination.note
    : Math.round((ficheDestination.note * 0.7 + ficheOT.note * 0.3) * 10) / 10

  const resultat = {
    destination: ficheDestination,
    ot: ficheOT,
    score_synthese: score,
    cout: { nb_appels: 2, cout_unitaire: 0.006, cout_total: 0.012 },
  }
  log('RÉSULTAT MAPS', resultat)
  return resultat
}

// ─── Module Instagram ─────────────────────────────────────────────────────────

async function testerInstagram() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  MODULE INSTAGRAM — Apify')
  console.log('═'.repeat(60))

  let postsCount  = null
  let postsRecents = []

  // Appel 1 : hashtag-stats
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

  // Appel 2 : hashtag-scraper
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

  // Ratio OT/UGC
  const nbOT = postsRecents.filter((p) => estCompteOT(p.username, HASHTAG)).length
  const ratio = `${nbOT}/${postsRecents.length}`

  const resultat = {
    hashtag: HASHTAG,
    posts_count: postsCount,
    posts_recents: postsRecents,
    ratio_ot_ugc: ratio,
    cout: { nb_appels: 2, cout_unitaire: 0.05, cout_total: 0.10 },
  }
  log('RÉSULTAT INSTAGRAM', resultat)
  return resultat
}

// ─── Module OpenAI ────────────────────────────────────────────────────────────

async function testerOpenAI(google, instagram) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log('  MODULE OPENAI — GPT-4o-mini')
  console.log('═'.repeat(60))

  const ficheOT = google.ot.absent
    ? 'Aucune fiche OT trouvée sur Google Maps.'
    : `Note OT : ${google.ot.note}/5 (${google.ot.avis} avis) — ${google.ot.nom}`

  const resumeInstagram = instagram.posts_count
    ? `${instagram.posts_count.toLocaleString('fr-FR')} posts pour #${instagram.hashtag}, ratio OT/UGC : ${instagram.ratio_ot_ugc}`
    : `Données Instagram partielles pour #${instagram.hashtag}`

  const exemplesPostsRecents = instagram.posts_recents
    .slice(0, 5)
    .map((p, i) => `  ${i + 1}. @${p.username} (${p.likes} likes) : "${p.caption}"`)
    .join('\n')

  const promptUser = `Destination touristique : ${DESTINATION}

DONNÉES GOOGLE MAPS :
- Destination : Note ${google.destination.note}/5 (${google.destination.avis} avis)
- ${ficheOT}
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

  try {
    const r = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: "Tu es un expert en marketing touristique français. Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires).",
          },
          { role: 'user', content: promptUser },
        ],
        temperature: 0.2,
        max_tokens: 400,
      },
      {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    )

    const brut = r.data.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
    const resultat = { ...parsed, cout: { nb_appels: 1, cout_unitaire: 0.001, cout_total: 0.001 } }
    log('RÉSULTAT OPENAI', resultat)
    return resultat
  } catch (err) {
    console.error('  ✗ Erreur OpenAI :', err.message)
    return { erreur: 'parsing_failed', raw: '', cout: { nb_appels: 1, cout_unitaire: 0.001, cout_total: 0.001 } }
  }
}

// ─── Orchestration ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'█'.repeat(60)}`)
  console.log(`  BLOC 1 — POSITIONNEMENT & NOTORIÉTÉ`)
  console.log(`  Destination : ${DESTINATION}  |  Hashtag : #${HASHTAG}`)
  console.log('█'.repeat(60))

  const debut = Date.now()

  // Étape 1 : Maps + Instagram en parallèle
  console.log('\n⏳ Étape 1 — Maps + Instagram en parallèle...')
  const [google, instagram] = await Promise.all([testerMaps(), testerInstagram()])

  // Étape 2 : OpenAI
  console.log('\n⏳ Étape 2 — Analyse OpenAI...')
  const positionnement = await testerOpenAI(google, instagram)

  // Résultat final agrégé
  const coutTotal = (google.cout?.cout_total ?? 0) + (instagram.cout?.cout_total ?? 0) + (positionnement.cout?.cout_total ?? 0)
  const duree = ((Date.now() - debut) / 1000).toFixed(1)

  console.log(`\n${'█'.repeat(60)}`)
  console.log('  RÉSULTAT FINAL AGRÉGÉ')
  console.log('█'.repeat(60))
  console.log(JSON.stringify({ google, instagram, positionnement, cout_total_bloc: Math.round(coutTotal * 10000) / 10000 }, null, 2))

  console.log(`\n✅ Terminé en ${duree}s — Coût estimé : ${coutTotal.toFixed(4)} €`)
}

main().catch((err) => {
  console.error('\n✗ Erreur fatale :', err.message)
  process.exit(1)
})
