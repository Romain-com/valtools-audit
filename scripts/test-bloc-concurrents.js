// Test Bloc 7 — Concurrents (v2 : séquence SEO 5 étapes + siteCompetitors)
// Usage : node scripts/test-bloc-concurrents.js "Annecy" "74010" "lac-annecy.com"
// ⚠️ Nécessite que Next.js tourne (npm run dev) — les routes API sont appelées directement

const http = require('http')

const destination = process.argv[2] ?? 'Annecy'
const code_insee = process.argv[3] ?? '74010'
const domaine_ot = process.argv[4] ?? 'lac-annecy.com'
const BASE_URL = 'http://localhost:3000'

// ─── Contexte de test Annecy (données issues des Blocs 1-6) ──────────────────

const CONTEXTE_ANNECY = {
  destination: 'Annecy',
  code_departement: '74',
  population: 126924,

  positionnement: {
    type_destination: 'ville lacustre de montagne',
    hashtag_volume: 4800000,
    note_google_destination: 4.5,
    note_google_ot: 4.3,
  },

  volume_affaires: {
    montant_ts: 3440837,
    nuitees_estimees: 2293891,
    type_collecteur: 'epci',
  },

  schema_digital: {
    domaine_ot: 'lac-annecy.com',
    score_visibilite_ot: 1,
    total_keywords: 53842,
    total_traffic: 161645,
  },

  visibilite_seo: {
    volume_marche_seeds: 640650,
    volume_transactionnel_gap: 180000,
    score_gap: 8,
    top_3_keywords: ['annecy tourisme', 'lac annecy', 'que faire annecy'],
  },

  stocks_physiques: {
    total_hebergements: 461,
    total_activites: 927,
    ratio_particuliers: 56.2,
  },

  stock_en_ligne: {
    total_airbnb: 4246,
    total_booking: 277,
    taux_dependance_ota: 9.8,
    taux_reservable_direct: 0.008,
  },
}

const METRIQUES_DESTINATION_ANNECY = {
  total_keywords: 53842,
  total_traffic: 161645,
  note_google: 4.5,
  nb_avis_google: 8200,
  score_visibilite_ot: 1,
  taux_dependance_ota: 9.8,
  nuitees_estimees: 2293891,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function postJSON(path, body, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }

    const req = http.request(options, (res) => {
      let raw = ''
      res.on('data', (chunk) => (raw += chunk))
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} : ${raw}`))
          return
        }
        try {
          resolve(JSON.parse(raw))
        } catch {
          reject(new Error(`JSON invalide : ${raw.slice(0, 200)}`))
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new Error(`Timeout ${timeoutMs / 1000}s`))
    })
    req.write(data)
    req.end()
  })
}

function fmt(n) {
  return (n ?? 0).toLocaleString('fr-FR')
}

function sep(titre) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${titre}`)
  console.log('─'.repeat(60))
}

// ─── Test Phase A ─────────────────────────────────────────────────────────────

async function testerPhaseA() {
  sep('PHASE A — Identification + siteCompetitors + Métriques')

  const t0 = Date.now()

  // ─── Étape 1 — Identification OpenAI ───────────────────────────────────────
  console.log(`\n[1] Identification des concurrents de ${destination}...`)
  let identification
  try {
    identification = await postJSON('/api/blocs/concurrents/identification', {
      destination,
      contexte: CONTEXTE_ANNECY,
    })
    console.log(`✅ ${identification.concurrents.length} concurrents identifiés`)
    for (const c of identification.concurrents) {
      const conf = c.confiance_domaine === 'certain' ? '✅' : '⚠️'
      console.log(
        `   ${conf} ${c.nom} (${c.departement}) → ${c.domaine_ot} [${c.confiance_domaine}]`
      )
      console.log(`      Raison : ${c.raison_selection}`)
    }
    console.log(`\n   Paysage : ${identification.analyse_paysage}`)
  } catch (err) {
    console.error('❌ Identification échouée :', err.message)
    process.exit(1)
  }

  // ─── Étape 2 — siteCompetitors Haloscan (test direct) ──────────────────────
  console.log(`\n[2] siteCompetitors Haloscan pour ${domaine_ot}...`)
  let haloscanCompetitors = []
  try {
    const res = await postJSON('/api/blocs/concurrents/site-competitors', {
      domaine_ot,
    }, 90000)
    haloscanCompetitors = res.competitors ?? []
    console.log(`✅ ${haloscanCompetitors.length} concurrent(s) SEO trouvés`)
    for (const c of haloscanCompetitors.slice(0, 5)) {
      console.log(
        `   ${c.root_domain} : ${fmt(c.common_keywords)} kw communs | ${fmt(c.total_traffic)} visites | ${fmt(c.missed_keywords)} manquants`
      )
    }
  } catch (err) {
    // Pas de route dédiée — le test appelle directement la phase-a
    console.log(`   ℹ️ Pas de route directe siteCompetitors — sera testé via Phase A complète`)
  }

  // ─── Étape 3 — Métriques pour chaque concurrent ────────────────────────────
  console.log('\n[3] Collecte des métriques (séquence 5 étapes)...')

  const concurrentsAvecMetriques = []
  let total_haloscan = 0
  let total_haloscan_positions = 0
  let total_dataforseo_ranked = 0
  let total_maps = 0

  for (const concurrent of identification.concurrents) {
    const domaine_valide = concurrent.domaine_ot.replace(/^www\./, '')
    const c = { ...concurrent, domaine_valide }

    process.stdout.write(`   → ${c.nom} (${domaine_valide})... `)
    try {
      const res = await postJSON('/api/blocs/concurrents/metriques', {
        concurrent: c,
        serp_cache: [],
      }, 120000)

      total_haloscan += res.couts.haloscan.nb_appels
      total_haloscan_positions += res.couts.haloscan_positions?.nb_appels ?? 0
      total_dataforseo_ranked += res.couts.dataforseo_ranked?.nb_appels ?? 0
      total_maps += res.couts.dataforseo_maps.nb_appels

      const m = res.metriques
      const note = m.note_google ? `${m.note_google}/5 (${m.nb_avis_google} avis)` : 'non dispo'
      const indexe = m.site_non_indexe ? ' ⚠️ NON INDEXÉ (5 sources)' : ''
      console.log(
        `✅ ${fmt(m.total_keywords)} kw | ${fmt(m.total_traffic)} visites | ${note} [${m.source_seo}]${indexe}`
      )
      concurrentsAvecMetriques.push({ ...c, metriques: m })
    } catch (err) {
      console.log(`❌ ${err.message}`)
      concurrentsAvecMetriques.push({
        ...c,
        metriques: {
          total_keywords: 0,
          total_traffic: 0,
          source_seo: 'inconnu',
          site_non_indexe: true,
          note_google: null,
          nb_avis_google: null,
          position_serp_requete_principale: null,
        },
      })
    }

    await new Promise((r) => setTimeout(r, 500))
  }

  const duree = ((Date.now() - t0) / 1000).toFixed(1)

  // ─── Tableau récapitulatif ─────────────────────────────────────────────────

  sep('RÉSULTATS PHASE A')

  console.log('\nTableau comparatif :')
  console.log(
    `${'Destination'.padEnd(25)} ${'Keywords'.padStart(10)} ${'Trafic'.padStart(10)} ${'Note Google'.padStart(12)} ${'Source'.padStart(20)} ${'Indexé'.padStart(8)}`
  )
  console.log('─'.repeat(90))
  for (const c of concurrentsAvecMetriques) {
    const m = c.metriques
    const note = m.note_google ? `${m.note_google}/5` : 'N/A'
    const indexe = m.site_non_indexe ? '❌ NON' : '✅ OUI'
    console.log(
      `${c.nom.padEnd(25)} ${fmt(m.total_keywords).padStart(10)} ${fmt(m.total_traffic).padStart(10)} ${note.padStart(12)} ${m.source_seo.padStart(20)} ${indexe.padStart(8)}`
    )
  }

  // Concurrents confirmés non indexés (site_non_indexe: true)
  const nonIndexes = concurrentsAvecMetriques.filter((c) => c.metriques.site_non_indexe)
  if (nonIndexes.length > 0) {
    console.log(`\n⚠️  Concurrents confirmés non indexés (5 sources épuisées) :`)
    for (const c of nonIndexes) {
      console.log(`   - ${c.nom} (${c.domaine_valide})`)
    }
  }

  // Coûts
  const cout_haloscan = total_haloscan * 0.01
  const cout_haloscan_positions = total_haloscan_positions * 0.01
  const cout_dataforseo_ranked = total_dataforseo_ranked * 0.006
  const cout_maps = total_maps * 0.006
  const cout_openai = 0.001
  const total =
    cout_haloscan + cout_haloscan_positions + cout_dataforseo_ranked + cout_maps + cout_openai

  console.log(`\nCoûts Phase A :`)
  console.log(
    `  Haloscan overview    : ${total_haloscan} appels = ${cout_haloscan.toFixed(3)}€`
  )
  console.log(
    `  Haloscan positions   : ${total_haloscan_positions} appels = ${cout_haloscan_positions.toFixed(3)}€`
  )
  console.log(
    `  DataForSEO ranked    : ${total_dataforseo_ranked} appels = ${cout_dataforseo_ranked.toFixed(3)}€`
  )
  console.log(`  DataForSEO Maps      : ${total_maps} appels = ${cout_maps.toFixed(3)}€`)
  console.log(`  OpenAI               : 1 appel = ${cout_openai.toFixed(3)}€`)
  console.log(`  TOTAL                : ${total.toFixed(3)}€`)
  console.log(`  Durée                : ${duree}s`)

  // Vérifications
  console.log(`\nVérifications :`)
  const avecSource = concurrentsAvecMetriques.filter((c) => c.metriques.source_seo !== 'inconnu')
  console.log(
    `  ✅ source_seo renseigné : ${avecSource.length}/${concurrentsAvecMetriques.length}`
  )
  const sitesNonIndexes = concurrentsAvecMetriques.filter((c) => c.metriques.site_non_indexe)
  console.log(
    `  📊 site_non_indexe: true = ${sitesNonIndexes.length} (vrai 0 confirmé 5 sources)`
  )

  return { concurrentsAvecMetriques, analyse_paysage: identification.analyse_paysage }
}

// ─── Test Phase B ─────────────────────────────────────────────────────────────

async function testerPhaseB(phaseAData) {
  sep('PHASE B — Synthèse comparative')

  const { concurrentsAvecMetriques, analyse_paysage } = phaseAData

  const tableau_comparatif = {
    destination_cible: {
      nom: destination,
      ...METRIQUES_DESTINATION_ANNECY,
    },
    concurrents: concurrentsAvecMetriques.map((c) => ({
      nom: c.nom,
      total_keywords: c.metriques.total_keywords,
      total_traffic: c.metriques.total_traffic,
      note_google: c.metriques.note_google,
      nb_avis_google: c.metriques.nb_avis_google,
      position_serp_requete_principale: c.metriques.position_serp_requete_principale,
    })),
  }

  console.log('\n[4] Synthèse comparative OpenAI...')
  try {
    const synthese = await postJSON('/api/blocs/concurrents/synthese', {
      destination,
      tableau_comparatif,
      // insight_gap non disponible dans ce test simple (nécessite Phase A complète via orchestrateur)
    })

    console.log(`\n✅ Synthèse générée`)
    console.log(`\nPosition globale : ${synthese.position_globale.toUpperCase()}`)
    console.log(`\nRésumé : ${synthese.resume}`)

    console.log('\nPoints forts :')
    for (const p of synthese.points_forts ?? []) {
      console.log(`  + ${p.critere} : ${p.valeur} (benchmark : ${p.benchmark})`)
    }

    console.log('\nPoints faibles :')
    for (const p of synthese.points_faibles ?? []) {
      console.log(`  - ${p.critere} : ${p.valeur} (benchmark : ${p.benchmark})`)
    }

    console.log(`\nOpportunité clé : ${synthese.opportunite_cle}`)
    console.log(`Message OT : ${synthese.message_ot}`)

    return synthese
  } catch (err) {
    console.error('❌ Synthèse échouée :', err.message)
    return null
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 Test Bloc 7 v2 — Concurrents (séquence SEO 5 étapes + siteCompetitors)`)
  console.log(`   Destination  : ${destination} (INSEE ${code_insee})`)
  console.log(`   Domaine OT   : ${domaine_ot}`)
  console.log(`   App URL      : ${BASE_URL}\n`)

  console.log(`Checklist de validation :`)
  console.log(`  [ ] siteCompetitors retourne des domaines concurrents`)
  console.log(`  [ ] Au moins 1 concurrent OpenAI matché avec siteCompetitors`)
  console.log(`  [ ] Séquence 5 étapes exécutée pour les domaines à 0`)
  console.log(`  [ ] site_non_indexe: true uniquement si toutes les 5 étapes retournent 0`)
  console.log(`  [ ] source_seo renseigné correctement par étape`)
  console.log(`  [ ] Coût total < 0.250€`)
  console.log(`  [ ] Durée Phase A < 90s\n`)

  try {
    const phaseAData = await testerPhaseA()

    sep('VALIDATION SIMULÉE')
    console.log('\n(Simulation : tous les concurrents conservés)')

    const synthese = await testerPhaseB(phaseAData)

    sep('RÉSULTAT FINAL')
    if (synthese) {
      console.log('✅ Bloc 7 v2 terminé avec succès')
    } else {
      console.log('⚠️ Bloc 7 v2 terminé avec erreurs partielles')
    }
  } catch (err) {
    console.error('\n❌ Erreur fatale :', err.message)
    process.exit(1)
  }
}

main()
