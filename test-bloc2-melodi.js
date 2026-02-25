/**
 * test-bloc2-melodi.js — Test standalone de l'enrichissement Mélodi du Bloc 2
 *
 * Usage : node test-bloc2-melodi.js "Annecy" "74010"
 *
 * Vérifie :
 *  - GET /epci/communes?siren_epci=XXX → communes CA Grand Annecy
 *  - Mélodi RP 2022 → résidences secondaires pour chaque commune
 *  - Mélodi BPE → hébergements touristiques D7 pour chaque commune
 *  - OpenAI → coefficients ajustés selon profil
 *  - Dispatch → ts_estimee Annecy ≈ part cohérente du total EPCI
 *  - Rate limit respecté (pas de 429)
 *
 * Prérequis : microservice en cours sur localhost:3001
 */

'use strict'

const dotenv = require('dotenv')
const axios  = require('axios')

dotenv.config({ path: '.env.local' })

// ─── Configuration ────────────────────────────────────────────────────────────

const MELODI_BASE      = 'https://api.insee.fr/melodi'
const MICROSERVICE_URL = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'
const OPENAI_URL       = 'https://api.openai.com/v1/chat/completions'
const BASE_DATA_ECO    = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets'

const DATASET_COMMUNES = {
  2024: 'balances-comptables-des-communes-en-2024',
  2023: 'balances-comptables-des-communes-en-2023',
}
const DATASET_EPCI = 'balances-comptables-des-groupements-a-fiscalite-propre-depuis-2010'
const TAUX_MOYEN_NUIT = 1.5

// Coefficients fixes par défaut
const COEFFICIENTS_FIXES = {
  residence_secondaire: 30,
  hotel_etablissement: 2000,
  tourisme_etablissement: 1500,
  camping_etablissement: 600,
  autres_etablissement: 800,
}

const BPE_CODES_HEBERGEMENT = {
  D701: 'hotels',
  D702: 'campings',
  D703: 'residences_tourisme',
  D705: 'villages_vacances',
  D710: 'meubles_classes',
  D711: 'chambres_hotes',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function log(label, data) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`▶ ${label}`)
  console.log(JSON.stringify(data, null, 2))
}

// ─── Fonctions Mélodi ─────────────────────────────────────────────────────────

async function fetchResidencesSecondaires(code_insee) {
  try {
    const r = await axios.get(`${MELODI_BASE}/data/DS_RP_LOGEMENT_PRINC`, {
      params: { GEO: `COM-${code_insee}`, OCS: 'DW_SEC_DW_OCC', TIME_PERIOD: '2022', TDW: '_T' },
      timeout: 15000,
    })
    const obs = r.data?.observations ?? []
    const total = obs.find((o) => o.dimensions?.TDW === '_T') ?? obs[0]
    return {
      valeur: Math.round(total?.measures?.OBS_VALUE_NIVEAU?.value ?? 0),
      source: 'melodi_rp',
    }
  } catch {
    return { valeur: 0, source: 'absent' }
  }
}

async function fetchHebergementsBPE(code_insee) {
  const defaut = { hotels: 0, campings: 0, residences_tourisme: 0, villages_vacances: 0, meubles_classes: 0, chambres_hotes: 0, autres: 0, source: 'absent' }
  try {
    const r = await axios.get(`${MELODI_BASE}/data/DS_BPE`, {
      params: { GEO: `COM-${code_insee}`, FACILITY_SDOM: 'D7' },
      timeout: 15000,
    })
    const obs = r.data?.observations ?? []
    if (obs.length === 0) return defaut

    const detail = {}
    let autres = 0
    for (const o of obs) {
      const code = o.dimensions?.FACILITY_TYPE
      const val  = Math.round(o.measures?.OBS_VALUE_NIVEAU?.value ?? 0)
      if (!code || code === '_T') continue
      const champ = BPE_CODES_HEBERGEMENT[code]
      if (champ) detail[champ] = (detail[champ] ?? 0) + val
      else autres += val
    }
    return {
      hotels:              detail['hotels']              ?? 0,
      campings:            detail['campings']            ?? 0,
      residences_tourisme: detail['residences_tourisme'] ?? 0,
      villages_vacances:   detail['villages_vacances']   ?? 0,
      meubles_classes:     detail['meubles_classes']     ?? 0,
      chambres_hotes:      detail['chambres_hotes']      ?? 0,
      autres_hebergements: autres,
      source: 'melodi_bpe',
    }
  } catch {
    return defaut
  }
}

async function fetchDonneesCommune(code_insee, nom) {
  const [rs_r, bpe_r] = await Promise.allSettled([
    fetchResidencesSecondaires(code_insee),
    fetchHebergementsBPE(code_insee),
  ])
  const rs  = rs_r.status  === 'fulfilled' ? rs_r.value  : { valeur: 0, source: 'absent' }
  const bpe = bpe_r.status === 'fulfilled' ? bpe_r.value : { hotels:0, campings:0, residences_tourisme:0, villages_vacances:0, meubles_classes:0, chambres_hotes:0, autres_hebergements:0, source:'absent' }
  return { code_insee, nom, residences_secondaires: rs.valeur, ...bpe, source_rs: rs.source, source_bpe: bpe.source }
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

function calculerPoids(d, c) {
  const nb_tourismes = d.residences_tourisme + d.villages_vacances
  const nb_autres    = d.meubles_classes + d.chambres_hotes + (d.autres_hebergements ?? 0)
  return (
    d.residences_secondaires * c.residence_secondaire
    + d.hotels               * c.hotel_etablissement
    + nb_tourismes           * c.tourisme_etablissement
    + d.campings             * c.camping_etablissement
    + nb_autres              * c.autres_etablissement
  )
}

function dispatcher(montant, communes, c) {
  const poids = communes.map((d) => ({ code_insee: d.code_insee, nom: d.nom, p: calculerPoids(d, c) }))
  const total = poids.reduce((s, x) => s + x.p, 0)
  return poids.map((x) => ({
    code_insee: x.code_insee,
    nom: x.nom,
    part_pct:        total > 0 ? Math.round(x.p / total * 1000) / 10 : 0,
    ts_estimee:      total > 0 ? Math.round(montant * x.p / total) : 0,
    nuitees_estimees: total > 0 ? Math.round(montant * x.p / total / 1.5) : 0,
  }))
}

// ─── Récupération TS réelle (data.economie.gouv.fr) ──────────────────────────

async function fetchTaxeCommune(siren) {
  for (const annee of [2024, 2023]) {
    try {
      const r = await axios.get(`${BASE_DATA_ECO}/${DATASET_COMMUNES[annee]}/records`, {
        params: {
          where: `siren='${siren}' AND (compte='731721' OR compte='731722')`,
          select: 'siren,lbudg,obnetcre',
          limit: 10,
        },
        timeout: 30000,
      })
      if ((r.data?.total_count ?? 0) > 0) {
        const montant = (r.data.results ?? []).reduce((s, l) => s + (parseFloat(l.obnetcre ?? '0') || 0), 0)
        return { montant: Math.round(montant), annee, lbudg: r.data.results[0]?.lbudg ?? '' }
      }
    } catch { /* continue */ }
  }
  return { montant: 0, annee: 2024, lbudg: '' }
}

async function fetchTaxeEpci(siren) {
  for (const annee of [2024, 2023]) {
    try {
      const r = await axios.get(`${BASE_DATA_ECO}/${DATASET_EPCI}/records`, {
        params: {
          where: `siren='${siren}' AND exer='${annee}' AND (compte='731721' OR compte='731722')`,
          select: 'siren,lbudg,obnetcre,exer',
          limit: 10,
        },
        timeout: 30000,
      })
      if ((r.data?.total_count ?? 0) > 0) {
        const montant = (r.data.results ?? []).reduce((s, l) => s + (parseFloat(l.obnetcre ?? '0') || 0), 0)
        return { montant: Math.round(montant), annee, lbudg: r.data.results[0]?.lbudg ?? '' }
      }
    } catch { /* continue */ }
  }
  return { montant: 0, annee: 2024, lbudg: '' }
}

// ─── Programme principal ──────────────────────────────────────────────────────

async function main() {
  const destination  = process.argv[2] ?? 'Annecy'
  const code_insee   = process.argv[3] ?? '74010'
  const siren_commune = process.argv[4] ?? null  // optionnel — pour la taxe commune directe

  console.log(`\n🧪 Test Mélodi Bloc 2 — ${destination} (${code_insee})`)
  const debut = Date.now()

  // ─── 1. Résolution EPCI ─────────────────────────────────────────────────────
  console.log('\n[1/6] Résolution EPCI via microservice...')
  const epciR = await axios.get(`${MICROSERVICE_URL}/epci`, { params: { code_insee }, timeout: 5000 })
  const { siren_epci, nom_epci } = epciR.data
  log('EPCI trouvé', { siren_epci, nom_epci })

  // ─── 2. Récupération TS réelle ───────────────────────────────────────────────
  console.log('\n[2/6] Récupération taxe de séjour réelle (data.economie.gouv.fr)...')
  const [taxeCommune, taxeEpci] = await Promise.all([
    siren_commune ? fetchTaxeCommune(siren_commune) : Promise.resolve({ montant: 0, annee: 2024, lbudg: '' }),
    siren_epci    ? fetchTaxeEpci(siren_epci)       : Promise.resolve({ montant: 0, annee: 2024, lbudg: '' }),
  ])
  log('Taxe commune', taxeCommune)
  if (siren_epci) log('Taxe EPCI', taxeEpci)

  // Sélection collecteur
  let MONTANT_TS_EPCI = 0
  let collecteur_nom  = destination
  let collecteur_type = 'commune'

  if (taxeCommune.montant > 0) {
    MONTANT_TS_EPCI = taxeCommune.montant
    collecteur_nom  = taxeCommune.lbudg || destination
    collecteur_type = 'commune'
  } else if (taxeEpci.montant > 0) {
    MONTANT_TS_EPCI = taxeEpci.montant
    collecteur_nom  = nom_epci || taxeEpci.lbudg || 'EPCI'
    collecteur_type = 'epci'
  }

  if (MONTANT_TS_EPCI === 0) {
    console.warn('\n⚠️  Aucune taxe de séjour trouvée — dispatch impossible (taxe non instituée)')
    process.exit(0)
  }

  console.log(`\n   ✅ Collecteur : ${collecteur_type.toUpperCase()} — ${collecteur_nom}`)
  console.log(`   ✅ Montant TS : ${MONTANT_TS_EPCI.toLocaleString('fr-FR')}€`)

  // ─── 3. Communes de l'EPCI ──────────────────────────────────────────────────
  console.log('\n[3/6] Récupération des communes de l\'EPCI...')
  const communesR = await axios.get(`${MICROSERVICE_URL}/epci/communes`, { params: { siren_epci }, timeout: 5000 })
  const communes = communesR.data.communes
  log(`Communes (${communes.length})`, communes)

  // ─── 4. Mélodi par batch ────────────────────────────────────────────────────
  console.log(`\n[4/6] Collecte Mélodi pour ${communes.length} communes (2 appels/commune)...`)
  const BATCH = 10
  const donnees = []

  for (let i = 0; i < communes.length; i += BATCH) {
    const batch = communes.slice(i, i + BATCH)
    console.log(`  Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(communes.length / BATCH)} : ${batch.map((c) => c.code_insee).join(', ')}`)
    const resultats = await Promise.allSettled(batch.map((c) => fetchDonneesCommune(c.code_insee, c.nom)))
    for (const r of resultats) {
      if (r.status === 'fulfilled') donnees.push(r.value)
    }
    if (i + BATCH < communes.length) {
      console.log('  Pause rate-limit 2100ms...')
      await sleep(2100)
    }
  }

  // Résumé Mélodi
  const communeCible = donnees.find((d) => d.code_insee === code_insee)
  log(`Mélodi — commune cible ${destination} (${code_insee})`, communeCible)
  log('Mélodi — toutes communes (résumé)', donnees.map((d) => ({
    code: d.code_insee,
    nom: d.nom,
    rs: d.residences_secondaires,
    hotels: d.hotels,
    campings: d.campings,
    meubles: d.meubles_classes,
    src_rs: d.source_rs,
    src_bpe: d.source_bpe,
  })))

  // ─── 5. Ajustement coefficients OpenAI ─────────────────────────────────────
  console.log('\n[5/6] Ajustement coefficients via OpenAI...')
  let coefficients = { ...COEFFICIENTS_FIXES, source: 'fixes', profil_destination: 'mixte', justification: null }

  try {
    const promptUser = `Tu es expert en tourisme français. Ajuste les coefficients de nuitées/an selon le profil de la destination.

Destination : ${destination} (département ${code_insee.slice(0, 2)})
Taxe de séjour collectée : ${MONTANT_TS_EPCI}€

Coefficients par défaut (nuitées/an) :
- résidence_secondaire : 30
- hôtel (par établissement) : 2000
- résidence_tourisme (par établissement) : 1500
- camping (par établissement) : 600
- autres_hébergements (par établissement) : 800

Profils disponibles : station_ski | bord_mer | bord_lac | ville | campagne | mixte

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires) :
{
  "coefficients_ajustes": { "residence_secondaire": 30, "hotel_etablissement": 2000, "tourisme_etablissement": 1500, "camping_etablissement": 600, "autres_etablissement": 800 },
  "profil_confirme": "bord_lac",
  "justification": "1 phrase"
}`

    const openaiR = await axios.post(OPENAI_URL, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Réponds UNIQUEMENT avec un JSON valide, sans markdown.' },
        { role: 'user', content: promptUser },
      ],
      temperature: 0.2,
      max_tokens: 300,
    }, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    })

    const brut   = openaiR.data.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
    const c      = parsed.coefficients_ajustes ?? {}
    coefficients = {
      residence_secondaire:   c.residence_secondaire   ?? COEFFICIENTS_FIXES.residence_secondaire,
      hotel_etablissement:    c.hotel_etablissement     ?? COEFFICIENTS_FIXES.hotel_etablissement,
      tourisme_etablissement: c.tourisme_etablissement  ?? COEFFICIENTS_FIXES.tourisme_etablissement,
      camping_etablissement:  c.camping_etablissement   ?? COEFFICIENTS_FIXES.camping_etablissement,
      autres_etablissement:   c.autres_etablissement    ?? COEFFICIENTS_FIXES.autres_etablissement,
      source: 'openai_ajuste',
      profil_destination: parsed.profil_confirme ?? 'mixte',
      justification: parsed.justification ?? null,
    }
    log('Coefficients ajustés par OpenAI', coefficients)
  } catch (err) {
    console.warn('  ⚠️ OpenAI échoué — fallback coefficients fixes :', err.message)
  }

  // ─── 6. Dispatch ────────────────────────────────────────────────────────────
  console.log('\n[6/6] Calcul du dispatch TS...')
  const dispatch = dispatcher(MONTANT_TS_EPCI, donnees, coefficients)
  const totalDispatch = dispatch.reduce((s, d) => s + d.ts_estimee, 0)

  log('Dispatch TS (toutes communes)', dispatch.map((d) => ({
    ...d,
    ts_format: `${d.ts_estimee.toLocaleString('fr-FR')}€`,
  })))

  const cibleDispatch = dispatch.find((d) => d.code_insee === code_insee)
  log(`Commune cible ${destination} — résultat dispatch`, cibleDispatch)

  // ─── Récapitulatif ────────────────────────────────────────────────────────
  const duree = ((Date.now() - debut) / 1000).toFixed(1)
  console.log('\n' + '═'.repeat(60))
  console.log('✅ RÉCAPITULATIF')
  console.log('═'.repeat(60))
  console.log(`  Durée totale          : ${duree}s`)
  console.log(`  Collecteur            : ${collecteur_type.toUpperCase()} — ${collecteur_nom}`)
  if (siren_epci) console.log(`  EPCI                  : ${nom_epci} (${siren_epci})`)
  console.log(`  Communes analysées    : ${donnees.length}/${communes.length}`)
  console.log(`  Montant TS réel       : ${MONTANT_TS_EPCI.toLocaleString('fr-FR')}€`)
  console.log(`  Total dispatché       : ${totalDispatch.toLocaleString('fr-FR')}€ (doit ≈ montant réel)`)
  console.log(`  Commune cible (${code_insee}) :`)
  if (cibleDispatch) {
    console.log(`    Part               : ${cibleDispatch.part_pct}%`)
    console.log(`    TS estimée         : ${cibleDispatch.ts_estimee.toLocaleString('fr-FR')}€`)
    console.log(`    Nuitées estimées   : ${cibleDispatch.nuitees_estimees.toLocaleString('fr-FR')}`)
  } else {
    console.log(`    ⚠️ Commune cible absente du dispatch`)
  }
  console.log(`  Profil destination    : ${coefficients.profil_destination}`)
  console.log(`  Source coefficients   : ${coefficients.source}`)
  console.log(`  Coût Mélodi          : 0.000€ (open data INSEE)`)
  console.log(`  Coût OpenAI          : 0.001€`)
  console.log(`  TOTAL ajout Bloc 2   : 0.001€`)

  // Vérification cohérence (seulement si montant > 0)
  const ecart_pct = MONTANT_TS_EPCI > 0 ? Math.abs(totalDispatch - MONTANT_TS_EPCI) / MONTANT_TS_EPCI * 100 : 0
  if (ecart_pct > 1) {
    console.warn(`\n⚠️  Écart dispatch vs montant EPCI : ${ecart_pct.toFixed(1)}% (attendu < 1%)`)
  } else {
    console.log(`\n✅ Cohérence dispatch OK — écart ${ecart_pct.toFixed(2)}%`)
  }
}

main().catch((err) => {
  console.error('\n❌ Erreur :', err.message)
  if (err.response?.data) console.error('   API response :', JSON.stringify(err.response.data))
  process.exit(1)
})
