// Test end-to-end — Bloc 5 : Stocks physiques (DATA Tourisme + Recherche Entreprises)
// Usage : node test-bloc5.js "Annecy" "74010"

const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

const destination = process.argv[2] ?? 'Annecy'
const code_insee  = process.argv[3] ?? '74010'

const MICROSERVICE_URL = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const RECHERCHE_URL = 'https://recherche-entreprises.api.gouv.fr/search'

const SEUIL_DOUBLON = 3

// ─── Codes NAF par catégorie (format avec point pour recherche-entreprises.api.gouv.fr) ──

const NAF_PAR_CATEGORIE = {
  hebergements: ['55.10Z', '55.20Z', '55.30Z', '55.90Z'],
  activites: ['93.11Z', '93.12Z', '93.13Z', '93.19Z', '93.21Z', '93.29Z', '79.90Z'],
  culture: ['90.01Z', '90.02Z', '90.03A', '91.01Z', '91.02Z', '91.03Z', '91.04Z'],
  services: ['79.11Z', '79.12Z', '79.90Z'],
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
    ok(`Hébergements : ${d.hebergements.total} (dont ${d.hebergements.hotels} hôtels)`)
    ok(`Activités : ${d.activites.total}`)
    ok(`Culture : ${d.culture.total}`)
    ok(`Services : ${d.services.total}`)
    if (d.etablissements_bruts.length > 0) {
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

// ─── Étape 2 : Recherche Entreprises (remplacement SIRENE) ───────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

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

  log(`Recherche Entreprises (SIRENE) — ${destination} en ${ms}ms`, {
    hebergements: hebergements.length,
    activites: activites.length,
    culture: culture.length,
    services: services.length,
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

  return { hebergements, activites, culture, services, total }
}

// ─── Étape 3 : Synthèse OpenAI ────────────────────────────────────────────────

async function testerSynthese(stocks) {
  const promptUser = `Destination : ${destination}
Stock physique total : ${stocks.total_stock_physique} établissements
Hébergements : ${stocks.hebergements.total_unique}, Activités : ${stocks.activites.total_unique}, Culture : ${stocks.culture.total_unique}, Services : ${stocks.services.total_unique}
Taux couverture DATA Tourisme : ${stocks.taux_couverture_dt}%

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
      max_tokens: 500,
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

// ─── Déduplication simplifiée ─────────────────────────────────────────────────

function normaliserNom(nom) {
  return (nom ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(sarl|sas|sa|eurl)\b/gi, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function deduplicer(dtEtabs, sirEtabs) {
  let doublons = 0
  const sirMatches = new Set()
  for (const dt of dtEtabs) {
    const nomDT = normaliserNom(dt.nom)
    for (let j = 0; j < sirEtabs.length; j++) {
      if (sirMatches.has(j)) continue
      const nomSIR = normaliserNom(sirEtabs[j].nom)
      if (nomDT === nomSIR || (nomDT.length > 4 && nomSIR.includes(nomDT)) || (nomSIR.length > 4 && nomDT.includes(nomSIR))) {
        doublons++
        sirMatches.add(j)
        break
      }
    }
  }
  return {
    dt_only: dtEtabs.length - doublons,
    sir_only: sirEtabs.length - sirMatches.size,
    deux_sources: doublons,
    total: dtEtabs.length - doublons + sirEtabs.length - sirMatches.size + doublons,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`TEST BLOC 5 — Stocks physiques`)
  console.log(`Destination : ${destination} | INSEE : ${code_insee}`)
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

  // Étape 3 — Déduplication simplifiée
  if (dtResult && sireneResult) {
    const dtHEtabs = dtResult.etablissements_bruts.filter(e => e.categorie === 'hebergements')
    const calc = deduplicer(dtHEtabs, sireneResult.hebergements)

    log('Déduplication hébergements', {
      dt_uniquement: calc.dt_only,
      recherche_entreprises_uniquement: calc.sir_only,
      dans_les_deux: calc.deux_sources,
      total_unique: calc.total,
    })

    const totalDoublons = calc.deux_sources
    const totalSirene = sireneResult.total

    const stocks = {
      total_stock_physique: dtResult.total_etablissements + sireneResult.total - totalDoublons,
      taux_couverture_dt: totalSirene > 0 ? Math.round((totalDoublons / totalSirene) * 100) : 0,
      hebergements: { total_unique: calc.total },
      activites: {
        total_unique: dtResult.activites.total + sireneResult.activites.length - Math.floor(Math.min(dtResult.activites.total, sireneResult.activites.length) * 0.3)
      },
      culture: {
        total_unique: dtResult.culture.total + sireneResult.culture.length - Math.floor(Math.min(dtResult.culture.total, sireneResult.culture.length) * 0.2)
      },
      services: {
        total_unique: dtResult.services.total + sireneResult.services.length - Math.floor(Math.min(dtResult.services.total, sireneResult.services.length) * 0.4)
      },
    }

    log('Stock physique final', stocks)
    ok(`Stock total estimé : ${stocks.total_stock_physique} établissements`)
    ok(`Taux de couverture DATA Tourisme : ${stocks.taux_couverture_dt}%`)

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
