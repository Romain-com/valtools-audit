// Test end-to-end — Bloc 5 : Stocks physiques (DATA Tourisme + Recherche Entreprises)
// Usage : node test-bloc5.js "Annecy" "74010"
// Flag  : --debug → affiche 5 exemples de scores de déduplication pour les hébergements

const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

const destination = process.argv[2] ?? 'Annecy'
const code_insee  = process.argv[3] ?? '74010'
const DEBUG_DEDUP = process.argv.includes('--debug')

const MICROSERVICE_URL = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const RECHERCHE_URL = 'https://recherche-entreprises.api.gouv.fr/search'

// Seuil abaissé depuis 3 → moins de faux négatifs (noms abrégés, raisons sociales)
const SEUIL_DOUBLON = 2

// ─── Codes NAF par catégorie (format avec point pour recherche-entreprises.api.gouv.fr) ──

const NAF_PAR_CATEGORIE = {
  hebergements: ['55.10Z', '55.20Z', '55.30Z', '55.90Z'],
  activites: ['93.11Z', '93.12Z', '93.13Z', '93.19Z', '93.21Z', '93.29Z', '79.90Z'],
  culture: ['90.01Z', '90.02Z', '90.03A', '91.01Z', '91.02Z', '91.03Z', '91.04Z'],
  services: ['79.11Z', '79.12Z', '79.90Z'],
}

// Mapping NAF → sous-catégorie (avec et sans point)
const NAF_SOUS_CAT_HEBERGEMENT = {
  '55.10Z': 'hotels',            '5510Z': 'hotels',
  '55.20Z': 'meubles_locations', '5520Z': 'meubles_locations',
  '55.30Z': 'campings',          '5530Z': 'campings',
  '55.90Z': 'autres',            '5590Z': 'autres',
}
const NAF_SOUS_CAT_ACTIVITES = {
  '93.11Z': 'sports_loisirs', '9311Z': 'sports_loisirs',
  '93.12Z': 'sports_loisirs', '9312Z': 'sports_loisirs',
  '93.13Z': 'sports_loisirs', '9313Z': 'sports_loisirs',
  '93.19Z': 'sports_loisirs', '9319Z': 'sports_loisirs',
  '93.21Z': 'experiences',    '9321Z': 'experiences',
  '93.29Z': 'experiences',    '9329Z': 'experiences',
  '79.90Z': 'agences_activites', '7990Z': 'agences_activites',
}
const NAF_SOUS_CAT_CULTURE = {
  '90.01Z': 'spectacle_vivant', '9001Z': 'spectacle_vivant',
  '90.02Z': 'spectacle_vivant', '9002Z': 'spectacle_vivant',
  '90.03A': 'spectacle_vivant', '9003A': 'spectacle_vivant',
  '91.01Z': 'musees_galeries',  '9101Z': 'musees_galeries',
  '91.02Z': 'musees_galeries',  '9102Z': 'musees_galeries',
  '91.03Z': 'patrimoine',       '9103Z': 'patrimoine',
  '91.04Z': 'nature',           '9104Z': 'nature',
}
const NAF_SOUS_CAT_SERVICES = {
  '79.11Z': 'agences_voyage', '7911Z': 'agences_voyage',
  '79.12Z': 'agences_voyage', '7912Z': 'agences_voyage',
  '79.90Z': 'agences_voyage', '7990Z': 'agences_voyage',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(etape, data) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`▶  ${etape}`)
  console.log('─'.repeat(60))
  if (typeof data === 'string') console.log(data)
  else console.log(JSON.stringify(data, null, 2))
}

function ok(msg) { console.log(`✅ ${msg}`) }
function warn(msg) { console.log(`⚠️  ${msg}`) }
function err(msg) { console.log(`❌ ${msg}`) }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function pct(volume, total) {
  if (total === 0) return 0
  return Math.round((volume / total) * 1000) / 10
}

// ─── Algo de déduplication — miroir de lib/blocs/stocks-physiques.ts ─────────

const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'de', 'du', 'des', 'et', 'en', 'au', 'aux',
  'un', 'une', 'sur', 'sous', 'par', 'pour',
  'hotel', 'camping', 'gite', 'residence', 'auberge', 'chalet', 'villa',
  'maison', 'chez', 'ste', 'saint', 'sainte',
])

function normaliserNom(nom) {
  return (nom ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(sarl|sas|sa|eurl|sci|sca|snc|scp|earl|gaec|sasu|ei|auto.entrepreneur)\b/gi, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function motsSignificatifs(nom) {
  return normaliserNom(nom)
    .split(' ')
    .filter(m => m.length > 2 && !MOTS_VIDES.has(m))
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1])
  return dp[m][n]
}

function scoreSimilarite(dt, sir) {
  let score = 0
  const nomDT = normaliserNom(dt.nom)
  const nomSIR = normaliserNom(sir.nom)

  if (nomDT === nomSIR) {
    score += 3
  } else if (nomDT.length > 3 && nomSIR.length > 3 && (nomDT.includes(nomSIR) || nomSIR.includes(nomDT))) {
    score += 2
  } else if (levenshtein(nomDT, nomSIR) <= 3) {
    score += 1
  }

  // Pivot mots significatifs
  const motsA = motsSignificatifs(nomDT)
  const motsB = motsSignificatifs(nomSIR)
  const setB = new Set(motsB)
  const intersection = motsA.filter(m => setB.has(m)).length
  if (intersection >= 2) score += 2
  else if (intersection === 1 && motsA.length <= 2) score += 1

  // Code postal
  if (dt.code_postal && sir.code_postal && dt.code_postal === sir.code_postal) {
    score += 1
  }

  return score
}

function deduplicerCategorie(dtEtabs, sirEtabs) {
  if (dtEtabs.length === 0 && sirEtabs.length === 0)
    return { dt_only: 0, sir_only: 0, deux_sources: 0, total: 0 }

  const sireneMatches = new Set()
  const dtMatches = new Set()

  for (let i = 0; i < dtEtabs.length; i++) {
    for (let j = 0; j < sirEtabs.length; j++) {
      if (sireneMatches.has(j)) continue
      if (scoreSimilarite(dtEtabs[i], sirEtabs[j]) >= SEUIL_DOUBLON) {
        dtMatches.add(i)
        sireneMatches.add(j)
        break
      }
    }
  }

  const deux_sources = sireneMatches.size
  const dt_only = dtEtabs.length - dtMatches.size
  const sir_only = sirEtabs.length - sireneMatches.size
  const total = dt_only + sir_only + deux_sources
  return { dt_only, sir_only, deux_sources, total }
}

function compterParNAF(etabs, mapping) {
  const compteurs = {}
  for (const etab of etabs) {
    const souscat = mapping[etab.naf]
    if (souscat) compteurs[souscat] = (compteurs[souscat] ?? 0) + 1
  }
  return compteurs
}

// ─── Debug déduplication — affiche les 5 premiers DT avec leurs meilleures paires SIRENE ──

function debugDeduplication(dtEtabs, sirEtabs, label) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`DEBUG DÉDUPLICATION — ${label} (5 premiers DT)`)
  console.log('═'.repeat(60))

  dtEtabs.slice(0, 5).forEach(dt => {
    const top3 = sirEtabs
      .map(sir => ({ sir_nom: sir.nom, score: scoreSimilarite(dt, sir), naf: sir.naf }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    console.log(`\n  DT : "${dt.nom}" (CP: ${dt.code_postal ?? 'n/a'})`)
    console.log(`       norm: "${normaliserNom(dt.nom)}"`)
    console.log(`       mots: [${motsSignificatifs(dt.nom).join(', ')}]`)
    top3.forEach(p => {
      const match = p.score >= SEUIL_DOUBLON ? '✅ MATCH' : '  ─'
      console.log(`       ${match} score=${p.score} → "${p.sir_nom}" (${p.naf})`)
    })
  })
}

// ─── Étape 0 : vérification microservice ─────────────────────────────────────

async function verifierMicroservice() {
  try {
    await axios.get(`${MICROSERVICE_URL}/health`, { timeout: 3000 })
    ok('Microservice joignable')
  } catch {
    err('Microservice non joignable — démarrer : cd microservice && npm run dev')
    process.exit(1)
  }
}

// ─── Étape 1 : DATA Tourisme /stocks ─────────────────────────────────────────

async function testerDataTourisme() {
  const debut = Date.now()
  const reponse = await axios.get(`${MICROSERVICE_URL}/stocks`, {
    params: { code_insee },
    timeout: 60000,
  })
  const ms = Date.now() - debut
  const d = reponse.data

  log(`DATA Tourisme /stocks — ${destination} (${code_insee}) en ${ms}ms`, {
    total_etablissements: d.total_etablissements,
    hebergements: d.hebergements,
    activites: d.activites,
    culture: d.culture,
    services: d.services,
  })

  if (d.total_etablissements > 0) {
    ok(`${d.total_etablissements} établissements classifiés`)
    ok(`Hébergements : ${d.hebergements.total} (${d.hebergements.hotels} hôtels, ${d.hebergements.locations} locations, ${d.hebergements.collectifs} collectifs)`)
    ok(`Activités : ${d.activites.total}`)
    ok(`Culture : ${d.culture.total} (patrimoine: ${d.culture.patrimoine}, religieux: ${d.culture.religieux}, musées: ${d.culture.musees_galeries}, spectacle: ${d.culture.spectacle_vivant}, nature: ${d.culture.nature})`)
    ok(`Services : ${d.services.total}`)
    if (d.etablissements_bruts?.length > 0) {
      console.log(`\n  Exemple établissements bruts (3 premiers) :`)
      d.etablissements_bruts.slice(0, 3).forEach(e => {
        console.log(`  - [${e.categorie}/${e.sous_categorie}] ${e.nom} — CP: ${e.code_postal ?? 'n/a'}`)
      })
    }
  } else {
    warn('Aucun établissement classifié — vérifier les types @type du corpus')
  }

  return d
}

// ─── Étape 2 : Recherche Entreprises ─────────────────────────────────────────

async function fetchEtablissementsNAF(codeNaf) {
  const etablissements = []
  let page = 1

  while (true) {
    const params = new URLSearchParams({
      code_commune: code_insee,
      activite_principale: codeNaf,
      etat_administratif: 'A',
      per_page: '25',
      page: String(page),
      limite_matching_etablissements: '25',
    })

    let r
    let tentatives = 0
    while (tentatives < 3) {
      r = await axios.get(`${RECHERCHE_URL}?${params}`, {
        headers: { Accept: 'application/json' },
        validateStatus: s => s < 500 || s === 429,
        timeout: 15000,
      })
      if (r.status === 429) {
        tentatives++
        await sleep(1500 * tentatives)
      } else {
        break
      }
    }

    if (r.status === 400) break
    if (r.status !== 200) throw new Error(`Recherche entreprises ${codeNaf} — HTTP ${r.status}`)

    for (const entreprise of r.data.results ?? []) {
      for (const etab of entreprise.matching_etablissements ?? []) {
        if (etab.commune !== code_insee) continue
        if (etab.etat_administratif !== 'A') continue
        etablissements.push({
          siret: etab.siret,
          nom: entreprise.nom_complet,
          naf: etab.activite_principale,
          adresse: etab.adresse ?? null,
          code_postal: etab.code_postal ?? null,
        })
      }
    }

    if (page >= (r.data.total_pages ?? 1) || r.data.results.length < 25) break
    page++
  }

  return etablissements
}

function deduplicerParSiret(etabs) {
  const vus = new Set()
  return etabs.filter(e => {
    if (vus.has(e.siret)) return false
    vus.add(e.siret)
    return true
  })
}

async function fetchCategorie(codesNaf) {
  const tous = []
  for (const naf of codesNaf) {
    const etabs = await fetchEtablissementsNAF(naf)
    tous.push(...etabs)
    await sleep(300)   // délai inter-requêtes pour respecter le rate limit
  }
  return deduplicerParSiret(tous)
}

async function testerRechercheEntreprises() {
  const debut = Date.now()
  console.log('\n  Interrogation recherche-entreprises.api.gouv.fr (sans auth)...')

  const [hebergements, activites, culture, services] = await Promise.all([
    fetchCategorie(NAF_PAR_CATEGORIE.hebergements),
    fetchCategorie(NAF_PAR_CATEGORIE.activites),
    fetchCategorie(NAF_PAR_CATEGORIE.culture),
    fetchCategorie(NAF_PAR_CATEGORIE.services),
  ])

  const ms = Date.now() - debut
  const total = hebergements.length + activites.length + culture.length + services.length

  // Comptages par sous-catégorie NAF
  const sirH = compterParNAF(hebergements, NAF_SOUS_CAT_HEBERGEMENT)
  const sirA = compterParNAF(activites, NAF_SOUS_CAT_ACTIVITES)
  const sirC = compterParNAF(culture, NAF_SOUS_CAT_CULTURE)
  const sirS = compterParNAF(services, NAF_SOUS_CAT_SERVICES)

  log(`Recherche Entreprises (SIRENE) — ${destination} en ${ms}ms`, {
    hebergements: { total: hebergements.length, detail_naf: sirH },
    activites: { total: activites.length, detail_naf: sirA },
    culture: { total: culture.length, detail_naf: sirC },
    services: { total: services.length, detail_naf: sirS },
    total_global: total,
  })

  if (total > 0) {
    ok(`${total} établissements actifs trouvés`)
    if (hebergements.length > 0) {
      console.log(`\n  Exemple hébergements (3 premiers) :`)
      hebergements.slice(0, 3).forEach(e => {
        console.log(`  - ${e.nom} (${e.naf}) — ${e.adresse?.substring(0, 50) ?? 'n/a'}`)
      })
    }
  } else {
    warn('Aucun établissement — vérifier la connexion à api.gouv.fr')
  }

  return { hebergements, activites, culture, services, total, sirH, sirA, sirC, sirS }
}

// ─── Étape 3 : Synthèse OpenAI ────────────────────────────────────────────────

async function testerSynthese(stocks) {
  const { hebergements: h, activites: a, culture: c, services: s } = stocks

  const fmt = (label, v) => `${label}: ${v.volume} (${v.pct}%)`

  const promptUser = `Destination : ${destination}
Stock physique total : ${stocks.total_stock_physique} établissements
Couverture DATA Tourisme globale : ${stocks.couverture.global}%
Ratio particuliers (meublés NAF 55.20Z) : ${stocks.ratio_particuliers_hebergement}%

HÉBERGEMENTS (${h.total_unique}) :
- ${fmt('Hôtels', h.detail.hotels)}
- ${fmt('Meublés/locations', h.detail.meubles_locations)}
- ${fmt('Campings', h.detail.campings)}

ACTIVITÉS (${a.total_unique}) :
- ${fmt('Sports & loisirs', a.detail.sports_loisirs)}
- ${fmt('Visites & circuits', a.detail.visites_tours)}

CULTURE (${c.total_unique}) :
- ${fmt('Patrimoine', c.detail.patrimoine)}
- ${fmt('Religieux', c.detail.religieux)}
- ${fmt('Musées & galeries', c.detail.musees_galeries)}

SERVICES (${s.total_unique})

Génère une synthèse courte pour un rapport d'audit digital.
Réponds UNIQUEMENT avec un JSON : { "points_forts": [], "points_attention": [], "indicateurs_cles": [{"label":"","valeur":"","interpretation":""}], "synthese_narrative": "" }`

  const reponse = await axios.post(
    OPENAI_URL,
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Expert tourisme. JSON uniquement, sans markdown.' },
        { role: 'user', content: promptUser },
      ],
      temperature: 0.2,
      max_tokens: 600,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 45000,
    }
  )

  const brut = reponse.data.choices?.[0]?.message?.content ?? ''
  return JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`TEST BLOC 5 — Stocks physiques`)
  console.log(`Destination : ${destination} | INSEE : ${code_insee}${DEBUG_DEDUP ? ' | MODE DEBUG' : ''}`)
  console.log('═'.repeat(60))

  await verifierMicroservice()

  // Étape 1 — DATA Tourisme
  let dtResult = null
  try {
    dtResult = await testerDataTourisme()
  } catch (e) {
    err(`DATA Tourisme échoué : ${e.message}`)
  }

  // Étape 2 — Recherche Entreprises
  let sireneResult = null
  try {
    sireneResult = await testerRechercheEntreprises()
  } catch (e) {
    err(`Recherche Entreprises échoué : ${e.message}`)
  }

  if (!dtResult && !sireneResult) {
    err('Aucune source disponible — test interrompu')
    process.exit(1)
  }

  if (dtResult && sireneResult) {
    // Séparation des établissements DT par catégorie
    const dtParCat = { hebergements: [], activites: [], culture: [], services: [] }
    for (const etab of dtResult.etablissements_bruts ?? []) {
      if (dtParCat[etab.categorie]) dtParCat[etab.categorie].push(etab)
    }

    // Debug déduplication hébergements (si flag --debug)
    if (DEBUG_DEDUP) {
      debugDeduplication(dtParCat.hebergements, sireneResult.hebergements, 'HÉBERGEMENTS')
    }

    // Déduplication complète sur les 4 catégories
    const calcH = deduplicerCategorie(dtParCat.hebergements, sireneResult.hebergements)
    const calcA = deduplicerCategorie(dtParCat.activites, sireneResult.activites)
    const calcC = deduplicerCategorie(dtParCat.culture, sireneResult.culture)
    const calcS = deduplicerCategorie(dtParCat.services, sireneResult.services)

    log('Déduplication par catégorie', {
      hebergements: { ...calcH, dt_brut: dtParCat.hebergements.length, sir_brut: sireneResult.hebergements.length },
      activites:    { ...calcA, dt_brut: dtParCat.activites.length,    sir_brut: sireneResult.activites.length    },
      culture:      { ...calcC, dt_brut: dtParCat.culture.length,       sir_brut: sireneResult.culture.length      },
      services:     { ...calcS, dt_brut: dtParCat.services.length,      sir_brut: sireneResult.services.length     },
      total_doublons: calcH.deux_sources + calcA.deux_sources + calcC.deux_sources + calcS.deux_sources,
    })

    // Volumes combinés hébergements
    const sirH = sireneResult.sirH
    const sirA = sireneResult.sirA
    const sirC = sireneResult.sirC
    const sirS = sireneResult.sirS

    const dtH = dtResult.hebergements
    const dtA = dtResult.activites
    // Fallbacks pour rétrocompatibilité si le microservice retourne l'ancienne structure (sans sous-cats culture)
    const dtC = {
      patrimoine: 0, religieux: 0, musees_galeries: 0, spectacle_vivant: 0, nature: 0,
      ...dtResult.culture,
    }
    const dtS = dtResult.services

    // Couverture par catégorie
    const couvH = sireneResult.hebergements.length > 0 ? Math.round((calcH.deux_sources / sireneResult.hebergements.length) * 100) : 0
    const couvA = sireneResult.activites.length > 0 ? Math.round((calcA.deux_sources / sireneResult.activites.length) * 100) : 0
    const couvC = sireneResult.culture.length > 0 ? Math.round((calcC.deux_sources / sireneResult.culture.length) * 100) : 0
    const couvS = sireneResult.services.length > 0 ? Math.round((calcS.deux_sources / sireneResult.services.length) * 100) : 0
    const couvGlobal = sireneResult.total > 0
      ? Math.round(((calcH.deux_sources + calcA.deux_sources + calcC.deux_sources + calcS.deux_sources) / sireneResult.total) * 100)
      : 0

    // Ratio particuliers hébergement
    const ratioParticuliers = sireneResult.hebergements.length > 0
      ? Math.round(((sirH.meubles_locations ?? 0) / sireneResult.hebergements.length) * 1000) / 10
      : 0

    const totalStock = calcH.total + calcA.total + calcC.total + calcS.total

    // Construction stocks finaux avec detail + pct
    const stocks = {
      total_stock_physique: totalStock,
      couverture: { hebergements: couvH, activites: couvA, culture: couvC, services: couvS, global: couvGlobal },
      ratio_particuliers_hebergement: ratioParticuliers,
      hebergements: {
        total_unique: calcH.total, dont_data_tourisme: calcH.dt_only,
        dont_sirene: calcH.sir_only, dont_deux_sources: calcH.deux_sources,
        detail: {
          hotels:            { volume: dtH.hotels + (sirH.hotels ?? 0),               pct: pct(dtH.hotels + (sirH.hotels ?? 0), calcH.total) },
          campings:          { volume: sirH.campings ?? 0,                             pct: pct(sirH.campings ?? 0, calcH.total) },
          meubles_locations: { volume: dtH.locations + (sirH.meubles_locations ?? 0), pct: pct(dtH.locations + (sirH.meubles_locations ?? 0), calcH.total) },
          collectifs:        { volume: dtH.collectifs,                                 pct: pct(dtH.collectifs, calcH.total) },
          autres:            { volume: dtH.autres + (sirH.autres ?? 0),               pct: pct(dtH.autres + (sirH.autres ?? 0), calcH.total) },
        },
      },
      activites: {
        total_unique: calcA.total, dont_data_tourisme: calcA.dt_only,
        dont_sirene: calcA.sir_only, dont_deux_sources: calcA.deux_sources,
        detail: {
          sports_loisirs:    { volume: dtA.sports_loisirs + (sirA.sports_loisirs ?? 0), pct: pct(dtA.sports_loisirs + (sirA.sports_loisirs ?? 0), calcA.total) },
          visites_tours:     { volume: dtA.visites_tours,                               pct: pct(dtA.visites_tours, calcA.total) },
          experiences:       { volume: dtA.experiences + (sirA.experiences ?? 0),       pct: pct(dtA.experiences + (sirA.experiences ?? 0), calcA.total) },
          agences_activites: { volume: sirA.agences_activites ?? 0,                     pct: pct(sirA.agences_activites ?? 0, calcA.total) },
        },
      },
      culture: {
        total_unique: calcC.total, dont_data_tourisme: calcC.dt_only,
        dont_sirene: calcC.sir_only, dont_deux_sources: calcC.deux_sources,
        detail: {
          patrimoine:       { volume: dtC.patrimoine + (sirC.patrimoine ?? 0),               pct: pct(dtC.patrimoine + (sirC.patrimoine ?? 0), calcC.total) },
          religieux:        { volume: dtC.religieux,                                          pct: pct(dtC.religieux, calcC.total) },
          musees_galeries:  { volume: dtC.musees_galeries + (sirC.musees_galeries ?? 0),     pct: pct(dtC.musees_galeries + (sirC.musees_galeries ?? 0), calcC.total) },
          spectacle_vivant: { volume: dtC.spectacle_vivant + (sirC.spectacle_vivant ?? 0),   pct: pct(dtC.spectacle_vivant + (sirC.spectacle_vivant ?? 0), calcC.total) },
          nature:           { volume: dtC.nature + (sirC.nature ?? 0),                       pct: pct(dtC.nature + (sirC.nature ?? 0), calcC.total) },
        },
      },
      services: {
        total_unique: calcS.total, dont_data_tourisme: calcS.dt_only,
        dont_sirene: calcS.sir_only, dont_deux_sources: calcS.deux_sources,
        detail: {
          offices_tourisme:  { volume: dtS.offices_tourisme,                   pct: pct(dtS.offices_tourisme, calcS.total) },
          agences_voyage:    { volume: dtS.agences + (sirS.agences_voyage ?? 0), pct: pct(dtS.agences + (sirS.agences_voyage ?? 0), calcS.total) },
          location_materiel: { volume: dtS.location_materiel,                   pct: pct(dtS.location_materiel, calcS.total) },
          transport:         { volume: dtS.transport,                            pct: pct(dtS.transport, calcS.total) },
        },
      },
    }

    log('Stock physique final', {
      total_stock_physique: stocks.total_stock_physique,
      couverture: stocks.couverture,
      ratio_particuliers_hebergement: stocks.ratio_particuliers_hebergement,
      hebergements_detail: stocks.hebergements.detail,
      activites_detail: stocks.activites.detail,
      culture_detail: stocks.culture.detail,
      services_detail: stocks.services.detail,
    })

    ok(`Stock total : ${stocks.total_stock_physique} établissements`)
    ok(`Couverture DATA Tourisme globale : ${stocks.couverture.global}%`)
    ok(`Ratio particuliers hébergement : ${stocks.ratio_particuliers_hebergement}%`)
    ok(`Doublons détectés : ${calcH.deux_sources + calcA.deux_sources + calcC.deux_sources + calcS.deux_sources}`)

    // Vérification cohérence
    const totalDoublons = calcH.deux_sources + calcA.deux_sources + calcC.deux_sources + calcS.deux_sources
    if (totalDoublons > 10) ok(`Déduplication améliorée : ${totalDoublons} doublons (> 10 attendus)`)
    else warn(`Seulement ${totalDoublons} doublons — algo peut encore être amélioré (lancer avec --debug)`)

    // Étape 4 — OpenAI
    try {
      const synthese = await testerSynthese(stocks)
      log('Synthèse OpenAI', synthese)
      ok('Synthèse générée avec succès')
    } catch (e) {
      err(`Synthèse OpenAI échouée : ${e.message}`)
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('Test Bloc 5 terminé')
  console.log('Coût estimé : ~0.001€ (OpenAI uniquement — toutes autres sources gratuites)')
  console.log('═'.repeat(60))
}

main().catch(e => {
  console.error('\n❌ Erreur fatale :', e.message)
  process.exit(1)
})
