// Test end-to-end — Bloc 2 : Volume d'affaires (taxe de séjour)
// Deux cas de test :
//   1. Vanves (commune collectrice directe attendue)
//   2. Annecy (résultat inconnu — afficher ce qui remonte)
// Appels directs aux APIs sans passer par Next.js

const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

// ─── Cas de test ──────────────────────────────────────────────────────────────

const CAS = [
  {
    label: 'Vanves',
    destination: 'Vanves',
    siren_commune: '219200755',
    code_insee: '92075',
    population_commune: 28000,
  },
  {
    label: 'Annecy',
    destination: 'Annecy',
    siren_commune: '200063402',
    code_insee: '74010',
    population_commune: 134738,
  },
]

// Datasets
const DATASET_COMMUNES = {
  2024: 'balances-comptables-des-communes-en-2024',
  2023: 'balances-comptables-des-communes-en-2023',
}
const DATASET_EPCI = 'balances-comptables-des-groupements-a-fiscalite-propre-depuis-2010'
const BASE_DATA_ECO = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const TAUX_MOYEN_NUIT = 1.5

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(etape, data) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`▶  ${etape}`)
  console.log('─'.repeat(60))
  console.log(JSON.stringify(data, null, 2))
}

// ─── Étape 0 : vérification du microservice ───────────────────────────────────

async function verifierMicroservice() {
  const apiUrl = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'
  try {
    await axios.get(`${apiUrl}/health`, { timeout: 3000 })
    console.log('✓ Microservice joignable')
  } catch {
    try {
      await axios.get(`${apiUrl}/epci`, {
        params: { code_insee: '00000' },
        timeout: 3000,
      })
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        console.error('\n✗ Microservice injoignable.')
        console.error('  Lance d\'abord : cd microservice && npm run dev')
        process.exit(1)
      }
      // 404 = microservice tourne mais code INSEE inexistant → OK
      console.log('✓ Microservice joignable')
    }
  }
}

// ─── Étape 1 : résolution EPCI ────────────────────────────────────────────────

async function etapeEpci(cas) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ÉTAPE 1 — EPCI (microservice) — ${cas.label}`)
  console.log('═'.repeat(60))

  const apiUrl = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'
  try {
    const r = await axios.get(`${apiUrl}/epci`, {
      params: { code_insee: cas.code_insee },
      timeout: 5000,
    })
    log('EPCI trouvé', r.data)
    return r.data
  } catch (err) {
    if (err.response?.status === 404) {
      console.log('  ℹ Commune sans EPCI (ou non trouvée)')
      return { siren_epci: null }
    }
    console.error('  ✗ Erreur EPCI :', err.message)
    return { siren_epci: null }
  }
}

// ─── Étape 2 : taxe de séjour ─────────────────────────────────────────────────

async function fetchTaxeCommune(siren) {
  for (const annee of [2024, 2023]) {
    const dataset = DATASET_COMMUNES[annee]
    try {
      const r = await axios.get(`${BASE_DATA_ECO}/${dataset}/records`, {
        params: {
          where: `siren='${siren}' AND (compte='731721' OR compte='731722')`,
          select: 'siren,lbudg,compte,obnetcre,nomen',
          limit: 10,
        },
        timeout: 30000,
      })
      const total = r.data?.total_count ?? 0
      if (total > 0) {
        const montant = (r.data.results ?? []).reduce((s, l) => s + (parseFloat(l.obnetcre ?? '0') || 0), 0)
        return { montant: Math.round(montant * 100) / 100, annee, lbudg: r.data.results[0]?.lbudg ?? '', dataset }
      }
    } catch (err) {
      console.error(`  ✗ Erreur dataset communes ${annee} :`, err.message)
    }
  }
  return { montant: 0, annee: 2024, lbudg: '', dataset: DATASET_COMMUNES[2024] }
}

async function fetchTaxeEpci(siren) {
  for (const annee of [2024, 2023]) {
    try {
      const r = await axios.get(`${BASE_DATA_ECO}/${DATASET_EPCI}/records`, {
        params: {
          where: `siren='${siren}' AND exer='${annee}' AND (compte='731721' OR compte='731722')`,
          select: 'siren,lbudg,compte,obnetcre,nomen,exer',
          limit: 10,
        },
        timeout: 30000,
      })
      const total = r.data?.total_count ?? 0
      if (total > 0) {
        const montant = (r.data.results ?? []).reduce((s, l) => s + (parseFloat(l.obnetcre ?? '0') || 0), 0)
        return { montant: Math.round(montant * 100) / 100, annee, lbudg: r.data.results[0]?.lbudg ?? '', dataset: DATASET_EPCI }
      }
    } catch (err) {
      console.error(`  ✗ Erreur dataset EPCI ${annee} :`, err.message)
    }
  }
  return { montant: 0, annee: 2024, lbudg: '', dataset: DATASET_EPCI }
}

async function etapeTaxe(cas, epciData) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ÉTAPE 2 — TAXE DE SÉJOUR (data.economie.gouv.fr) — ${cas.label}`)
  console.log('═'.repeat(60))

  console.log(`\n[1/2] Taxe commune — SIREN ${cas.siren_commune}`)
  const [taxeCommune, taxeEpci] = await Promise.all([
    fetchTaxeCommune(cas.siren_commune),
    epciData.siren_epci
      ? (console.log(`[2/2] Taxe EPCI — SIREN ${epciData.siren_epci}`), fetchTaxeEpci(epciData.siren_epci))
      : Promise.resolve(null),
  ])

  log('Taxe commune', taxeCommune)
  if (taxeEpci) log('Taxe EPCI', taxeEpci)

  return { taxeCommune, taxeEpci }
}

// ─── Étape 3 : sélection du collecteur ───────────────────────────────────────

function selectionnerCollecteur(cas, epciData, taxeCommune, taxeEpci) {
  if (taxeCommune.montant > 0) {
    return {
      siren: cas.siren_commune,
      nom: taxeCommune.lbudg || cas.destination,
      type_collecteur: 'commune',
      annee_donnees: taxeCommune.annee,
      montant_taxe_euros: taxeCommune.montant,
      nuitees_estimees: Math.round(taxeCommune.montant / TAUX_MOYEN_NUIT),
      dataset_source: taxeCommune.dataset,
    }
  }

  if (taxeEpci && taxeEpci.montant > 0) {
    return {
      siren: epciData.siren_epci,
      nom: epciData.nom_epci ?? taxeEpci.lbudg ?? 'EPCI',
      type_collecteur: 'epci',
      type_epci: epciData.type_epci,
      population_epci: epciData.population_epci,
      annee_donnees: taxeEpci.annee,
      montant_taxe_euros: taxeEpci.montant,
      nuitees_estimees: Math.round(taxeEpci.montant / TAUX_MOYEN_NUIT),
      dataset_source: taxeEpci.dataset,
    }
  }

  return null // taxe non instituée
}

// ─── Étape 4 : analyse OpenAI ─────────────────────────────────────────────────

async function etapeOpenAI(cas, collecteur) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ÉTAPE 3 — OPENAI — ${cas.label}`)
  console.log('═'.repeat(60))

  const est_epci = collecteur.type_collecteur === 'epci'
  const montantFormate = collecteur.montant_taxe_euros.toLocaleString('fr-FR')
  const nuiteesFormatees = collecteur.nuitees_estimees.toLocaleString('fr-FR')

  let promptUser
  if (est_epci) {
    promptUser = `Destination auditée : ${cas.destination}
La taxe de séjour est collectée par ${collecteur.nom} (${collecteur.type_epci}).
Montant total EPCI : ${montantFormate}€ en ${collecteur.annee_donnees}.
Nuitées estimées EPCI (taux moyen national 1,50€/nuit) : ${nuiteesFormatees}.

Estime la part de la commune ${cas.destination} dans ce total EPCI selon son poids touristique.

Réponds avec ce JSON exact :
{
  "part_commune": {
    "pourcentage": 35,
    "montant_euros": 125000,
    "raisonnement": "2-3 phrases expliquant l'estimation"
  },
  "synthese_volume": "80-100 mots...",
  "indicateurs_cles": ["chiffre 1", "chiffre 2", "chiffre 3"]
}`
  } else {
    promptUser = `Destination : ${cas.destination}
Montant taxe de séjour collectée : ${montantFormate}€ en ${collecteur.annee_donnees}.
Nuitées estimées (taux moyen national 1,50€/nuit) : ${nuiteesFormatees}.

Réponds avec ce JSON exact :
{
  "synthese_volume": "80-100 mots...",
  "indicateurs_cles": ["chiffre 1", "chiffre 2", "chiffre 3"]
}`
  }

  const r = await axios.post(
    OPENAI_URL,
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es expert en finances locales françaises et tourisme. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.',
        },
        { role: 'user', content: promptUser },
      ],
      temperature: 0.2,
      max_tokens: 500,
    },
    {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    }
  )

  const brut = r.data.choices?.[0]?.message?.content ?? ''
  const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
  log('Analyse OpenAI', parsed)
  return parsed
}

// ─── Test d'un cas ────────────────────────────────────────────────────────────

async function testerCas(cas) {
  console.log(`\n${'█'.repeat(60)}`)
  console.log(`  AUDIT BLOC 2 — ${cas.label.toUpperCase()}`)
  console.log(`  SIREN : ${cas.siren_commune}  |  INSEE : ${cas.code_insee}`)
  console.log('█'.repeat(60))

  const debut = Date.now()

  // Étape 1 : EPCI
  const epciData = await etapeEpci(cas)

  // Étape 2 : Taxes en parallèle
  const { taxeCommune, taxeEpci } = await etapeTaxe(cas, epciData)

  // Étape 3 : Sélection collecteur
  const collecteur = selectionnerCollecteur(cas, epciData, taxeCommune, taxeEpci)

  if (!collecteur) {
    console.log(`\n⚠  Taxe de séjour non instituée pour ${cas.destination} — arrêt du test`)
    return
  }

  log('COLLECTEUR SÉLECTIONNÉ', collecteur)

  // Étape 4 : OpenAI
  const openaiResult = await etapeOpenAI(cas, collecteur)

  // Résultat final
  const resultat = {
    collecteur,
    taxe_non_instituee: false,
    openai: {
      synthese_volume: openaiResult.synthese_volume ?? '',
      indicateurs_cles: openaiResult.indicateurs_cles ?? [],
    },
    meta: {
      annee_donnees: collecteur.annee_donnees,
      taux_moyen_utilise: TAUX_MOYEN_NUIT,
      dataset_source: collecteur.dataset_source,
      cout_total_euros: 0.001,
    },
  }

  if (collecteur.type_collecteur === 'epci' && openaiResult.part_commune) {
    resultat.part_commune_estimee = openaiResult.part_commune
  }

  const duree = ((Date.now() - debut) / 1000).toFixed(1)

  console.log(`\n${'█'.repeat(60)}`)
  console.log(`  RÉSULTAT FINAL — ${cas.label.toUpperCase()}`)
  console.log('█'.repeat(60))
  console.log(JSON.stringify(resultat, null, 2))
  console.log(`\n✅ ${cas.label} terminé en ${duree}s — Coût estimé : 0.0010 €`)
}

// ─── Orchestration ────────────────────────────────────────────────────────────

async function main() {
  await verifierMicroservice()

  for (const cas of CAS) {
    await testerCas(cas)
  }
}

main().catch((err) => {
  console.error('\n✗ Erreur fatale :', err.message)
  process.exit(1)
})
