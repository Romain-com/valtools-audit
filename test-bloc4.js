// test-bloc4.js — Test standalone Bloc 4 : Visibilité SEO & Gap Transactionnel
// ⚠️  Ne pas déclencher la Phase B automatiquement — attendre validation manuelle
// Usage : node test-bloc4.js [destination] [domaine_ot]
// Exemple : node test-bloc4.js "Annecy" "lac-annecy.com"

require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

// ─── Configuration ────────────────────────────────────────────────────────────

const DESTINATION  = process.argv[2] || 'Annecy'
const DOMAINE_OT   = process.argv[3] || 'lac-annecy.com'
const CODE_INSEE   = '74010'
const BATCH_SIZE   = 50
const LANCER_PHASE_B = process.argv.includes('--phase-b')

const HALOSCAN_URL          = 'https://api.haloscan.com/api/keywords/overview'
const DATAFORSEO_RANKED_URL = 'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live'
const DATAFORSEO_RELATED_URL = 'https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live'
const OPENAI_URL            = 'https://api.openai.com/v1/chat/completions'

const HALOSCAN_API_KEY  = process.env.HALOSCAN_API_KEY
const DATAFORSEO_LOGIN  = process.env.DATAFORSEO_LOGIN
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY

// Vérification des variables d'environnement
function verifierEnv() {
  const manquantes = []
  if (!HALOSCAN_API_KEY)    manquantes.push('HALOSCAN_API_KEY')
  if (!DATAFORSEO_LOGIN)    manquantes.push('DATAFORSEO_LOGIN')
  if (!DATAFORSEO_PASSWORD) manquantes.push('DATAFORSEO_PASSWORD')
  if (!OPENAI_API_KEY)      manquantes.push('OPENAI_API_KEY')
  if (manquantes.length) {
    console.error('❌ Variables manquantes dans .env.local :', manquantes.join(', '))
    process.exit(1)
  }
}

// ─── Module 1 : Haloscan keywords/overview (8 seeds en parallèle) ────────────

async function appelSeed(keyword, seed) {
  try {
    const res = await axios.post(
      HALOSCAN_URL,
      {
        keyword,
        requested_data: ['keyword_match', 'similar_highlight', 'related_question', 'seo_metrics', 'ads_metrics'],
      },
      {
        headers: { 'haloscan-api-key': HALOSCAN_API_KEY, 'Content-Type': 'application/json' },
        timeout: 30_000,
      }
    )
    const data = res.data
    const cpc = data.ads_metrics?.cpc
    const competition = data.ads_metrics?.competition

    const extraire = (items, source) =>
      (items || [])
        .filter((item) => item.keyword && typeof item.volume === 'number' && item.volume > 0)
        .map((item) => ({ keyword: item.keyword, volume: item.volume, source, seed, cpc, competition }))

    return {
      keywords: [
        ...extraire(data.keyword_match?.results, 'keyword_match'),
        ...extraire(data.similar_highlight?.results, 'similar_highlight'),
      ],
      paa: extraire(data.related_question?.results, 'related_question'),
      volume_seed: data.seo_metrics?.volume || data.ads_metrics?.volume || 0,
    }
  } catch (err) {
    console.error(`  ❌ Erreur seed "${keyword}" :`, err.message)
    return { keywords: [], paa: [], volume_seed: 0 }
  }
}

// ─── Module 2 : DataForSEO related_keywords (4 seeds en parallèle) ───────────

async function appelSeedRelated(keyword) {
  try {
    const res = await axios.post(
      DATAFORSEO_RELATED_URL,
      [{
        keyword,
        location_code: 2250,
        language_code: 'fr',
        limit: 100,
        depth: 2,
        include_seed_keyword: true,
      }],
      {
        auth: { username: DATAFORSEO_LOGIN, password: DATAFORSEO_PASSWORD },
        timeout: 60_000,
      }
    )
    const items = res.data?.tasks?.[0]?.result?.[0]?.items || []
    return items
      .filter((item) => item.keyword_data?.keyword && typeof item.keyword_data?.keyword_info?.search_volume === 'number' && item.keyword_data.keyword_info.search_volume > 0)
      .map((item) => ({
        keyword: item.keyword_data.keyword,
        volume: item.keyword_data.keyword_info.search_volume,
        cpc: item.keyword_data?.keyword_info?.cpc || null,
        source_seed: keyword,
      }))
  } catch (err) {
    console.error(`  ❌ Erreur related seed "${keyword}" :`, err.message)
    return []
  }
}

async function testerDataForSEORelated() {
  console.log('\n📊 Module 2 — DataForSEO related_keywords/live (4 seeds en parallèle)')
  const seeds = [
    DESTINATION,
    `tourisme ${DESTINATION}`,
    `activités ${DESTINATION}`,
    `visiter ${DESTINATION}`,
  ]
  console.log(`  Seeds : ${seeds.map((s) => `"${s}"`).join(' | ')}`)

  const resultats = await Promise.all(seeds.map((seed) => appelSeedRelated(seed)))

  // Déduplication par volume max
  const parKeyword = new Map()
  for (const liste of resultats) {
    for (const kw of liste) {
      const cle = kw.keyword.toLowerCase().trim()
      const existant = parKeyword.get(cle)
      if (!existant || kw.volume > existant.volume) parKeyword.set(cle, kw)
    }
  }

  const keywords = Array.from(parKeyword.values()).sort((a, b) => b.volume - a.volume)

  console.log(`  ✅ ${keywords.length} keywords related (dédupliqués)`)
  console.log(`  Coût : 4 × 0.006€ = 0.024€`)

  const top10 = keywords.slice(0, 10)
  console.log('\n  Top 10 keywords related :')
  top10.forEach((kw) => {
    const cpc = kw.cpc ? ` | CPC: ${Number(kw.cpc).toFixed(2)}€` : ''
    console.log(`    ${kw.keyword.padEnd(40)} vol: ${String(kw.volume).padStart(6)} | seed: ${kw.source_seed}${cpc}`)
  })

  return { keywords }
}

// Patterns hors-tourisme évidents — même liste que dans classification/route.ts
const PATTERNS_HORS_TOURISME = [
  /^météo\b/i,
  /\bmétéo (pour |à |de |en )?/i,
  /^temps (qu'il fait|prévu|à)/i,
  /prévisions? météo/i,
  /\bsncf\b/i,
  /horaires? (train|bus|tram|car)\b/i,
  /^itinéraire\b/i,
]

async function testerHaloscanMarket() {
  console.log('\n📊 Module 1 — Haloscan keywords/overview (8 seeds en parallèle)')
  const seeds = [
    { keyword: DESTINATION,                   seed: 'destination' },
    { keyword: `tourisme ${DESTINATION}`,      seed: 'tourisme' },
    { keyword: `que faire ${DESTINATION}`,     seed: 'que_faire' },
    { keyword: `activités ${DESTINATION}`,     seed: 'activites' },
    { keyword: `hébergement ${DESTINATION}`,   seed: 'hebergement' },
    { keyword: `visiter ${DESTINATION}`,       seed: 'visiter' },
    { keyword: `vacances ${DESTINATION}`,      seed: 'vacances' },
    { keyword: `week-end ${DESTINATION}`,      seed: 'week_end' },
  ]
  console.log(`  Seeds : ${seeds.map((s) => `"${s.keyword}"`).join(' | ')}`)

  const resultats = await Promise.all(seeds.map(({ keyword, seed }) => appelSeed(keyword, seed)))

  // Fusion + déduplication
  const parKeyword = new Map()
  for (const { keywords } of resultats) {
    for (const kw of keywords) {
      const cle = kw.keyword.toLowerCase().trim()
      const existant = parKeyword.get(cle)
      if (!existant || kw.volume > existant.volume) parKeyword.set(cle, kw)
    }
  }

  const parPAA = new Map()
  for (const { paa } of resultats) {
    for (const kw of paa) {
      const cle = kw.keyword.toLowerCase().trim()
      if (!parPAA.has(cle)) parPAA.set(cle, kw)
    }
  }

  const keywords_marche = Array.from(parKeyword.values())
  const paa_detectes = Array.from(parPAA.values())
  const volume_marche_seeds = keywords_marche.reduce((acc, kw) => acc + kw.volume, 0)

  console.log(`  ✅ ${keywords_marche.length} keywords marché | ${paa_detectes.length} PAA`)
  console.log(`  Volume marché seeds : ${volume_marche_seeds.toLocaleString('fr-FR')} recherches/mois`)
  console.log(`  Coût : 8 × 0.010€ = 0.080€`)

  // Afficher les top 10 keywords
  const top10 = keywords_marche.sort((a, b) => b.volume - a.volume).slice(0, 10)
  console.log('\n  Top 10 keywords marché :')
  top10.forEach((kw) => {
    const cpc = kw.cpc ? ` | CPC: ${kw.cpc.toFixed(2)}€` : ''
    console.log(`    ${kw.keyword.padEnd(40)} vol: ${String(kw.volume).padStart(6)} | source: ${kw.source}${cpc}`)
  })

  return { keywords_marche, paa_detectes, volume_marche_seeds }
}

// ─── Module 3 : DataForSEO ranked_keywords ───────────────────────────────────

// Estimation CTR par position
function estimerTraficCapte(keywords) {
  const ctr = { 1: 0.28, 2: 0.15, 3: 0.10, 4: 0.07, 5: 0.05, 6: 0.04, 7: 0.03, 8: 0.025, 9: 0.02, 10: 0.015 }
  return Math.round(
    keywords.reduce((total, kw) => {
      const taux = ctr[kw.position] || (kw.position <= 20 ? 0.01 : 0.005)
      return total + kw.volume * taux
    }, 0)
  )
}

async function testerDataForSEORanked() {
  console.log('\n📊 Module 3 — DataForSEO ranked_keywords/live')
  console.log(`  Domaine OT : ${DOMAINE_OT}`)

  try {
    const res = await axios.post(
      DATAFORSEO_RANKED_URL,
      [{
        target: DOMAINE_OT,
        location_code: 2250,
        language_code: 'fr',
        limit: 200,
        item_types: ['organic'],
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
      }],
      {
        auth: { username: DATAFORSEO_LOGIN, password: DATAFORSEO_PASSWORD },
        timeout: 60_000,
      }
    )

    const items = res.data?.tasks?.[0]?.result?.[0]?.items || []
    const keywords_positionnes_ot = items
      .filter((item) => item.keyword_data?.keyword && item.ranked_serp_element?.serp_item?.rank_group !== undefined)
      .map((item) => ({
        keyword: item.keyword_data.keyword,
        volume: item.keyword_data?.keyword_info?.search_volume || 0,
        position: item.ranked_serp_element.serp_item.rank_group,
        url_positionnee: item.ranked_serp_element?.serp_item?.url || '',
        cpc: item.keyword_data?.keyword_info?.cpc,
      }))

    const trafic_capte_estime = estimerTraficCapte(keywords_positionnes_ot)

    console.log(`  ✅ ${keywords_positionnes_ot.length} keywords positionnés`)
    console.log(`  Trafic capté estimé : ${trafic_capte_estime.toLocaleString('fr-FR')} visites/mois`)
    console.log(`  Coût : 1 × 0.006€ = 0.006€`)

    // Top 10 keywords positionnés
    const top10 = keywords_positionnes_ot.slice(0, 10)
    console.log('\n  Top 10 keywords positionnés :')
    top10.forEach((kw) => {
      console.log(`    pos ${String(kw.position).padStart(3)} | ${kw.keyword.padEnd(40)} vol: ${String(kw.volume).padStart(6)}`)
    })

    return { keywords_positionnes_ot, trafic_capte_estime }
  } catch (err) {
    console.error('  ❌ Erreur DataForSEO ranked :', err.message)
    return { keywords_positionnes_ot: [], trafic_capte_estime: 0 }
  }
}

// ─── Module 4 : Classification OpenAI ────────────────────────────────────────

function preparerKeywordsInput(keywords_marche, keywords_positionnes_ot) {
  // Appliquer le filtre pré-OpenAI (même logique que dans classification/route.ts)
  keywords_marche = keywords_marche.filter(
    (kw) => !PATTERNS_HORS_TOURISME.some((pattern) => pattern.test(kw.keyword))
  )
  const positionsOT = new Map()
  for (const kw of keywords_positionnes_ot) {
    const cle = kw.keyword.toLowerCase().trim()
    if (!positionsOT.has(cle) || kw.position < positionsOT.get(cle)) {
      positionsOT.set(cle, kw.position)
    }
  }

  const parKeyword = new Map()
  for (const kw of keywords_marche) {
    const cle = kw.keyword.toLowerCase().trim()
    const position = positionsOT.get(cle) || null
    if (!parKeyword.has(cle) || kw.volume > (parKeyword.get(cle)?.volume || 0)) {
      parKeyword.set(cle, { keyword: kw.keyword, volume: kw.volume, cpc: kw.cpc, position_ot: position })
    }
  }

  for (const kw of keywords_positionnes_ot) {
    const cle = kw.keyword.toLowerCase().trim()
    if (!parKeyword.has(cle)) {
      parKeyword.set(cle, { keyword: kw.keyword, volume: kw.volume, cpc: kw.cpc, position_ot: kw.position })
    }
  }

  return Array.from(parKeyword.values()).sort((a, b) => b.volume - a.volume).slice(0, 300)
}

async function classifierBatch(keywords, batchIndex) {
  const lignes = keywords
    .map((kw) => {
      const posInfo = kw.position_ot !== null ? `pos_ot:${kw.position_ot}` : 'pos_ot:absent'
      const cpcInfo = kw.cpc ? ` | cpc:${Number(kw.cpc).toFixed(2)}€` : ''
      return `${kw.keyword} | vol:${kw.volume} | ${posInfo}${cpcInfo}`
    })
    .join('\n')

  const systemPrompt = `Tu es expert SEO touristique. Tu réponds uniquement en JSON valide.

RÈGLES STRICTES :
- "météo [destination]" et toutes variantes météo → catégorie "hors-tourisme", intent_transactionnel: false
- Keywords sans lien direct avec le tourisme (actualités locales, services municipaux, résultats sportifs, escort, séisme...) → "hors-tourisme"
- intent_transactionnel: true UNIQUEMENT si le keyword exprime clairement une intention d'achat, réservation ou location (pas juste informatif)
- gap: true UNIQUEMENT si position_ot > 20 ou position_ot est null (pos_ot ≤ 20 = JAMAIS un gap)`

  const prompt = `Classifie ces ${keywords.length} keywords pour la destination "${DESTINATION}".

Pour chaque keyword, retourne un objet JSON avec :
- keyword (string, exact)
- volume (number, identique à l'input)
- categorie : une valeur parmi ["activités","hébergements","services","culture","restauration","transports","hors-tourisme"]
- intent_transactionnel : true si cpc > 0.30 OU si le keyword contient "réserver|réservation|booking|prix|location|billet|entrée|tarif|louer|acheter"
- position_ot : number ou null (reprendre pos_ot de l'input — null si "absent")
- gap : true si le keyword est touristique ET (pos_ot est null OU pos_ot > 20)

Exclure les keywords "hors-tourisme" du tableau retourné.

Keywords à classer :
${lignes}

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires) :
{ "keywords_classes": [ ... ] }`

  const res = await axios.post(
    OPENAI_URL,
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    },
    {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 90_000,
    }
  )

  const brut = res.data.choices?.[0]?.message?.content || ''
  try {
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
    return parsed.keywords_classes || []
  } catch {
    console.error(`  ❌ Erreur parsing JSON batch ${batchIndex} :`, brut.slice(0, 200))
    return []
  }
}

async function testerClassification(keywords_marche, keywords_positionnes_ot) {
  console.log('\n📊 Module 4 — Classification OpenAI (gpt-4o-mini)')

  const keywords_input = preparerKeywordsInput(keywords_marche, keywords_positionnes_ot)
  console.log(`  ${keywords_input.length} keywords à classer`)

  const batches = []
  for (let i = 0; i < keywords_input.length; i += BATCH_SIZE) {
    batches.push(keywords_input.slice(i, i + BATCH_SIZE))
  }
  console.log(`  ${batches.length} batch(es) de max ${BATCH_SIZE} keywords`)

  const resultats = []
  for (let i = 0; i < batches.length; i++) {
    console.log(`  Batch ${i + 1}/${batches.length} (${batches[i].length} keywords)...`)
    const batch_res = await classifierBatch(batches[i], i + 1)
    resultats.push(...batch_res)
  }

  // Règle dure post-OpenAI : forcer gap = false si position_ot ≤ 20
  const keywords_classes = resultats
    .filter((kw) => kw.categorie !== 'hors-tourisme')
    .map((kw) => ({
      ...kw,
      gap: kw.position_ot !== null && kw.position_ot <= 20 ? false : kw.gap,
    }))

  const avec_gap = keywords_classes.filter((kw) => kw.gap)
  const transac_gap = avec_gap.filter((kw) => kw.intent_transactionnel)
  const absence_totale = avec_gap.filter((kw) => kw.position_ot === null)

  console.log(`  ✅ ${keywords_classes.length} keywords classifiés (hors-tourisme exclus)`)
  console.log(`  Keywords avec gap : ${avec_gap.length} (dont ${transac_gap.length} transac | ${absence_totale.length} absences totales)`)
  console.log(`  Coût : ${batches.length} × 0.001€ = ${(batches.length * 0.001).toFixed(3)}€`)

  // Afficher les top gaps transactionnels
  const top_gaps = transac_gap.sort((a, b) => b.volume - a.volume).slice(0, 10)
  if (top_gaps.length) {
    console.log('\n  Top gaps transactionnels :')
    top_gaps.forEach((kw) => {
      const pos = kw.position_ot ? `pos ${kw.position_ot}` : 'absent'
      console.log(`    ${kw.keyword.padEnd(45)} vol: ${String(kw.volume).padStart(6)} | ${pos} | ${kw.categorie}`)
    })
  }

  return { keywords_classes, nb_appels_openai: batches.length }
}

// ─── Module 5 : SERP live Phase B ─────────────────────────────────────────────

const MAX_KEYWORDS_PHASE_B = 8

function selectionnerKeywordsPhaseB(keywords_classes) {
  const transac_gap = keywords_classes
    .filter((kw) => kw.gap && kw.intent_transactionnel)
    .sort((a, b) => b.volume - a.volume)

  const absences_totales = keywords_classes
    .filter((kw) => kw.gap && kw.position_ot === null && !kw.intent_transactionnel)
    .sort((a, b) => b.volume - a.volume)

  const moitie = Math.ceil(MAX_KEYWORDS_PHASE_B / 2)
  const selection = [
    ...transac_gap.slice(0, moitie),
    ...absences_totales.slice(0, MAX_KEYWORDS_PHASE_B - Math.min(moitie, transac_gap.length)),
  ]

  // Compléter si pas assez
  if (selection.length < MAX_KEYWORDS_PHASE_B) {
    const dejaDans = new Set(selection.map((kw) => kw.keyword))
    const reste = keywords_classes
      .filter((kw) => kw.gap && !dejaDans.has(kw.keyword))
      .sort((a, b) => b.volume - a.volume)
    selection.push(...reste.slice(0, MAX_KEYWORDS_PHASE_B - selection.length))
  }

  return selection.slice(0, MAX_KEYWORDS_PHASE_B)
}

async function testerSERPTransac(keywords_classes) {
  const keywords_selectionnes = selectionnerKeywordsPhaseB(keywords_classes)
  console.log(`\n📊 Module 5 — DataForSEO SERP live Phase B (${keywords_selectionnes.length} keywords séquentiels)`)

  if (!keywords_selectionnes.length) {
    console.log('  ⚠️  Aucun keyword gap sélectionné — Phase B ignorée')
    return { serp_results: [], nb_appels: 0 }
  }

  console.log('  Keywords sélectionnés :')
  keywords_selectionnes.forEach((kw) => {
    const pos = kw.position_ot ? `pos ${kw.position_ot}` : 'absent'
    const flag = kw.intent_transactionnel ? '[transac]' : '[absence]'
    console.log(`    ${kw.keyword.padEnd(45)} vol: ${String(kw.volume).padStart(6)} | ${pos} ${flag}`)
  })

  const domaineOTNu = DOMAINE_OT.replace(/^www\./, '')
  const serp_results = []
  let nb_appels = 0

  for (const kw of keywords_selectionnes) {
    try {
      const res = await axios.post(
        'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
        [{ keyword: kw.keyword, language_code: 'fr', location_code: 2250, depth: 20 }],
        { auth: { username: DATAFORSEO_LOGIN, password: DATAFORSEO_PASSWORD }, timeout: 60_000 }
      )
      nb_appels++
      const items = res.data?.tasks?.[0]?.result?.[0]?.items ?? []
      const organiques = items.filter((item) => item.type === 'organic')

      let position_ot = null
      let url_ot = null
      for (const item of organiques) {
        const domaine = (item.domain || '').replace(/^www\./, '')
        if (domaine === domaineOTNu) {
          position_ot = item.rank_group || item.rank_absolute || null
          url_ot = item.url || null
          break
        }
      }

      const pos1 = organiques[0]
      serp_results.push({
        keyword: kw.keyword,
        position_ot,
        url_ot,
        concurrent_pos1: pos1?.domain || null,
        concurrent_pos1_url: pos1?.url || null,
      })

      const posLabel = position_ot ? `pos ${position_ot}` : 'absent'
      console.log(`  ✅ "${kw.keyword}" → OT: ${posLabel} | pos1: ${pos1?.domain || 'inconnu'}`)
    } catch (err) {
      nb_appels++
      console.error(`  ❌ Erreur SERP "${kw.keyword}" :`, err.message)
      serp_results.push({ keyword: kw.keyword, position_ot: null, url_ot: null, concurrent_pos1: null, concurrent_pos1_url: null })
    }
  }

  console.log(`  Coût : ${nb_appels} × 0.006€ = ${(nb_appels * 0.006).toFixed(3)}€`)
  return { serp_results, nb_appels }
}

// ─── Module 6 : Synthèse OpenAI Phase B ──────────────────────────────────────

async function testerSynthese(keywords_classes, serp_results, paa_detectes, trafic_capte_estime, volume_marche_seeds) {
  console.log('\n📊 Module 6 — Synthèse OpenAI Phase B (gpt-4o-mini)')

  // trafic_capte_estime est déjà calculé avec CTR par position dans dataforseo-ranked
  const trafic_estime_capte = trafic_capte_estime || 0

  // Taux de captation = trafic / volume marché seeds, plafonné à 100%
  const vol_marche = volume_marche_seeds || 0
  const taux_captation = vol_marche > 0
    ? Math.min(100, Math.round((trafic_estime_capte / vol_marche) * 1000) / 10)
    : 0

  // Croisement Phase A ↔ SERP live → vrais_gaps (position > 20 ou absente confirmée live)
  const serp_map = new Map(serp_results.map((s) => [s.keyword.toLowerCase(), s]))
  const vrais_gaps = keywords_classes
    .filter((kw) => kw.gap && kw.intent_transactionnel)
    .map((kw) => {
      const serp_live = serp_map.get(kw.keyword.toLowerCase())
      const position_live = serp_live ? serp_live.position_ot : kw.position_ot
      const gap_confirme = position_live === null || position_live > 20
      return {
        keyword: kw.keyword,
        volume: kw.volume,
        categorie: kw.categorie,
        position_ot: position_live,
        concurrent_pos1: serp_live?.concurrent_pos1 ?? null,
        gain_potentiel_trafic: Math.round(kw.volume * 0.10),
        gap_confirme,
      }
    })
    .filter((kw) => kw.gap_confirme)
    .sort((a, b) => b.volume - a.volume)

  const lignes_vrais_gaps = vrais_gaps
    .slice(0, 50)
    .map((g) => {
      const pos = g.position_ot !== null ? `pos_ot:${g.position_ot}` : 'OT:absent'
      return `${g.keyword} | vol:${g.volume} | cat:${g.categorie} | ${pos} | pos1:${g.concurrent_pos1 || 'inconnu'} | gain:${g.gain_potentiel_trafic}`
    })
    .join('\n')

  const prompt = `Tu es expert en SEO et marketing digital touristique. Analyse le gap SEO transactionnel du site ${DOMAINE_OT} pour la destination ${DESTINATION}.

Données clés :
- Trafic estimé capté par l'OT : ${trafic_estime_capte.toLocaleString('fr-FR')} visites/mois (via CTR par position)
- Volume marché total détecté : ${vol_marche.toLocaleString('fr-FR')} recherches/mois
- Taux de captation : ${taux_captation}%
NOTE: taux_captation est calculé en amont — ne pas le recalculer.

Vrais gaps confirmés par SERP live (positions > 20 ou absentes) :
${lignes_vrais_gaps || 'Aucun gap confirmé'}

Questions PAA sans réponse sur le site OT :
${(paa_detectes || []).slice(0, 20).map((p) => `- ${p.keyword}`).join('\n')}

RÈGLES STRICTES :
- top_5_opportunites : choisir UNIQUEMENT parmi les keywords listés dans "vrais gaps" ci-dessus
- Ne jamais inclure un keyword avec position_ot ≤ 10
- Priorité aux keywords avec concurrent_pos1 identifié
- gain_potentiel_trafic : reprendre la valeur "gain" de la liste (ne pas recalculer)

Retourne UNIQUEMENT ce JSON valide (sans markdown, sans commentaires) :
{
  "top_5_opportunites": [
    { "keyword": "string", "volume": number, "categorie": "string", "position_ot": number_ou_null, "concurrent_pos1": "string_ou_null", "gain_potentiel_trafic": number }
  ],
  "paa_sans_reponse": ["question 1", "question 2"],
  "score_gap": number_entre_0_et_10,
  "synthese_narrative": "2-3 phrases résumant le gap et les opportunités prioritaires pour un directeur d'OT"
}`

  try {
    const res = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Tu es expert SEO touristique. Tu réponds uniquement en JSON valide. Tu choisis les opportunités UNIQUEMENT parmi la liste fournie.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 60_000 }
    )
    const brut = res.data.choices?.[0]?.message?.content || ''
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
    console.log(`  ✅ Synthèse générée | score_gap: ${parsed.score_gap}/10`)
    console.log(`  Coût : 1 × 0.001€ = 0.001€`)
    return { parsed, trafic_estime_capte, taux_captation, vol_marche, vrais_gaps }
  } catch (err) {
    console.error('  ❌ Erreur synthèse OpenAI :', err.message)
    return { parsed: null, trafic_estime_capte, taux_captation, vol_marche, vrais_gaps }
  }
}

// ─── Résumé Phase B ───────────────────────────────────────────────────────────

function afficherResumePhaseB(serp, synthese, cout_phase_a) {
  console.log('\n' + '═'.repeat(70))
  console.log('  RÉSUMÉ PHASE B — ' + DESTINATION.toUpperCase() + ' | ' + DOMAINE_OT)
  console.log('═'.repeat(70))

  console.log(`  SERP live analysés     : ${serp.serp_results.length} keywords (${serp.nb_appels} appels)`)
  console.log(`  Vrais gaps confirmés   : ${synthese.vrais_gaps.length} (position > 20 ou absente live)`)
  console.log(`  Trafic estimé capté    : ${synthese.trafic_estime_capte.toLocaleString('fr-FR')} visites/mois (CTR par position)`)
  console.log(`  Volume marché détecté  : ${synthese.vol_marche.toLocaleString('fr-FR')} req/mois`)
  console.log(`  Taux de captation      : ${synthese.taux_captation}% (plafonné à 100%)`)

  if (synthese.parsed) {
    console.log(`  Score gap              : ${synthese.parsed.score_gap}/10`)
    console.log(`\n  Synthèse : ${synthese.parsed.synthese_narrative}`)

    if (synthese.parsed.top_5_opportunites?.length) {
      console.log('\n  Top 5 opportunités :')
      synthese.parsed.top_5_opportunites.forEach((op, i) => {
        const pos = op.position_ot !== null ? `pos ${op.position_ot}` : 'absent'
        console.log(`    ${i + 1}. ${op.keyword.padEnd(40)} vol: ${String(op.volume).padStart(6)} | ${pos} | ${op.categorie}`)
      })
    }

    if (synthese.parsed.paa_sans_reponse?.length) {
      console.log('\n  PAA sans réponse OT :')
      synthese.parsed.paa_sans_reponse.slice(0, 5).forEach((q) => console.log(`    - ${q}`))
    }
  }

  const cout_serp = serp.nb_appels * 0.006
  const cout_synthese = 0.001
  const cout_phase_b = cout_serp + cout_synthese

  console.log('\n  Coûts Phase B :')
  console.log(`    DataForSEO SERP live (${serp.nb_appels} appels): ${cout_serp.toFixed(3)}€`)
  console.log(`    OpenAI synthèse              : ${cout_synthese.toFixed(3)}€`)
  console.log(`    TOTAL PHASE B                : ${cout_phase_b.toFixed(3)}€`)
  console.log(`    TOTAL BLOC 4 (A + B)         : ${(cout_phase_a + cout_phase_b).toFixed(3)}€`)
  console.log('═'.repeat(70))
}

// ─── Résumé Phase A ───────────────────────────────────────────────────────────

function afficherResume(haloscan, related, ranked, classification) {
  console.log('\n' + '═'.repeat(70))
  console.log('  RÉSUMÉ PHASE A — ' + DESTINATION.toUpperCase() + ' | ' + DOMAINE_OT)
  console.log('═'.repeat(70))

  const nbGap = classification.keywords_classes.filter((k) => k.gap).length
  const nbTransacGap = classification.keywords_classes.filter((k) => k.gap && k.intent_transactionnel).length
  const nbAbsences = classification.keywords_classes.filter((k) => k.gap && k.position_ot === null).length

  const volume_positionne_ot = ranked.keywords_positionnes_ot.reduce((sum, kw) => sum + (kw.volume || 0), 0)
  const volume_transactionnel_gap = classification.keywords_classes
    .filter((k) => k.gap && k.intent_transactionnel)
    .reduce((sum, kw) => sum + (kw.volume || 0), 0)

  const nb_haloscan = haloscan ? haloscan.keywords_marche.length : 0
  const nb_related = related ? related.keywords.length : 0
  // Total corpus marché fusionné (sans doublons — estimé via classification)
  console.log(`  Sources corpus marché :`)
  console.log(`    Haloscan (8 seeds)          : ${nb_haloscan} keywords${haloscan ? '' : ' ⚠️  ECHEC SOURCE'}`)
  console.log(`    DataForSEO related (4 seeds): ${nb_related} keywords${related ? '' : ' ⚠️  ECHEC SOURCE'}`)
  console.log(`  PAA détectés                  : ${haloscan ? haloscan.paa_detectes.length : 0}`)
  console.log(`  Keywords positionnés OT        : ${ranked.keywords_positionnes_ot.length}`)
  console.log(`  Keywords classifiés            : ${classification.keywords_classes.length}`)
  console.log(`  Keywords avec gap              : ${nbGap} (dont ${nbTransacGap} transac | ${nbAbsences} absences totales)`)
  console.log('')
  console.log('  Volumes (périmètres distincts — ne pas comparer entre eux) :')
  console.log(`    volume_marche_seeds      : ${(haloscan ? haloscan.volume_marche_seeds : 0).toLocaleString('fr-FR')} req/mois  (demande autour de la destination)`)
  console.log(`    volume_positionne_ot     : ${volume_positionne_ot.toLocaleString('fr-FR')} req/mois  (périmètre réel OT dans Google)`)
  console.log(`    volume_transactionnel_gap: ${volume_transactionnel_gap.toLocaleString('fr-FR')} req/mois  (potentiel commercial non capté)`)
  console.log(`    trafic_capte_ot_estime   : ${ranked.trafic_capte_estime.toLocaleString('fr-FR')} visites/mois`)

  const cout_haloscan = haloscan ? 8 * 0.01 : 0
  const cout_related = related ? 4 * 0.006 : 0
  const cout_ranked = 0.006
  const cout_openai = classification.nb_appels_openai * 0.001
  const cout_total = cout_haloscan + cout_related + cout_ranked + cout_openai

  console.log('\n  Coûts Phase A :')
  console.log(`    Haloscan market (8 seeds)   : ${cout_haloscan.toFixed(3)}€`)
  console.log(`    DataForSEO related (4 seeds): ${cout_related.toFixed(3)}€`)
  console.log(`    DataForSEO ranked (1 appel) : ${cout_ranked.toFixed(3)}€`)
  console.log(`    OpenAI (${classification.nb_appels_openai} appel${classification.nb_appels_openai > 1 ? 's' : ''})            : ${cout_openai.toFixed(3)}€`)
  console.log(`    TOTAL PHASE A               : ${cout_total.toFixed(3)}€`)

  if (LANCER_PHASE_B) {
    console.log('\n  → Phase B déclenchée via --phase-b')
  } else {
    console.log('\n  ℹ️  Phase B non déclenchée — passer --phase-b pour la lancer')
    console.log(`  ℹ️  Phase B estimée : ~${Math.min(nbTransacGap, 8)} appels SERP × 0.006€ + 1 OpenAI = ~${((Math.min(nbTransacGap, 8) * 0.006) + 0.001).toFixed(3)}€`)
  }
  console.log('═'.repeat(70))

  return cout_total
}

// ─── Orchestration principale ─────────────────────────────────────────────────

async function main() {
  console.log('🚀 Test Bloc 4 — Visibilité SEO & Gap Transactionnel')
  console.log(`   Destination : ${DESTINATION} | OT : ${DOMAINE_OT} | INSEE : ${CODE_INSEE}`)
  console.log(`   Date : ${new Date().toISOString()}\n`)

  verifierEnv()

  const debut = Date.now()

  // Étape 1 : Haloscan + DataForSEO related + DataForSEO ranked en parallèle (Promise.allSettled)
  console.log('⏳ Étape 1 : Haloscan market + DataForSEO related + DataForSEO ranked (parallèle)...')
  const [haloscan_settled, related_settled, ranked_settled] = await Promise.allSettled([
    testerHaloscanMarket(),
    testerDataForSEORelated(),
    testerDataForSEORanked(),
  ])

  // Extraire les valeurs — null si la source a échoué
  const haloscan = haloscan_settled.status === 'fulfilled' ? haloscan_settled.value : null
  const related  = related_settled.status === 'fulfilled'  ? related_settled.value  : null
  const ranked   = ranked_settled.status === 'fulfilled'   ? ranked_settled.value   : null

  if (haloscan_settled.status === 'rejected') console.warn('  ⚠️  Haloscan market échoué :', haloscan_settled.reason?.message)
  if (related_settled.status === 'rejected')  console.warn('  ⚠️  DataForSEO related échoué :', related_settled.reason?.message)
  if (ranked_settled.status === 'rejected')   console.warn('  ⚠️  DataForSEO ranked échoué :', ranked_settled.reason?.message)

  if (!ranked) {
    console.error('\n💥 DataForSEO ranked indisponible — impossible de continuer Phase A')
    process.exit(1)
  }

  // Fusion corpus marché : Haloscan (prioritaire) + DataForSEO related filtré (complément)
  const dest = DESTINATION.toLowerCase()
  const mapKeywords = new Map()
  for (const kw of haloscan?.keywords_marche ?? []) {
    mapKeywords.set(kw.keyword.toLowerCase().trim(), kw)
  }
  for (const kw of related?.keywords ?? []) {
    const cle = kw.keyword.toLowerCase().trim()
    // Filtre pertinence : contient la destination OU ≥ 3 mots (assez spécifique pour un OT)
    if (!cle.includes(dest) && cle.split(' ').length < 3) continue
    if (!mapKeywords.has(cle)) {
      mapKeywords.set(cle, { keyword: kw.keyword, volume: kw.volume, source: 'dataforseo_related', seed: kw.source_seed, cpc: kw.cpc })
    }
  }
  const keywords_marche_fusionnes = Array.from(mapKeywords.values())
    .filter((kw) => kw.volume > 0)
    .sort((a, b) => b.volume - a.volume)

  console.log(`\n  → Corpus marché fusionné : ${keywords_marche_fusionnes.length} keywords uniques`)

  // Étape 2 : Classification OpenAI
  console.log('\n⏳ Étape 2 : Classification OpenAI...')
  const classification = await testerClassification(keywords_marche_fusionnes, ranked.keywords_positionnes_ot)

  // Résumé Phase A
  const cout_phase_a = afficherResume(haloscan, related, ranked, classification)

  const duree_a = ((Date.now() - debut) / 1000).toFixed(1)
  console.log(`\n⏱️  Durée Phase A : ${duree_a}s`)

  // ─── Phase B (optionnelle) ────────────────────────────────────────────────
  if (LANCER_PHASE_B) {
    const paa = haloscan?.paa_detectes ?? []

    console.log('\n⏳ Étape 3 : SERP live Phase B...')
    const serp = await testerSERPTransac(classification.keywords_classes)

    console.log('\n⏳ Étape 4 : Synthèse OpenAI Phase B...')
    const synthese = await testerSynthese(
      classification.keywords_classes,
      serp.serp_results,
      paa,
      ranked.trafic_capte_estime,
      haloscan?.volume_marche_seeds ?? 0
    )

    afficherResumePhaseB(serp, synthese, cout_phase_a)
  }

  const duree = ((Date.now() - debut) / 1000).toFixed(1)
  console.log(`\n⏱️  Durée totale : ${duree}s`)

  // Export JSON complet (optionnel — décommenter pour debug)
  /*
  const result = {
    destination: DESTINATION,
    domaine_ot: DOMAINE_OT,
    phase_a: {
      keywords_marche: haloscan.keywords_marche,
      paa_detectes: haloscan.paa_detectes,
      keywords_positionnes_ot: ranked.keywords_positionnes_ot,
      keywords_classes: classification.keywords_classes,
      volume_marche_total: haloscan.volume_marche_total,
      volume_transactionnel_total: classification.volume_transactionnel_total,
      trafic_capte_ot_estime: ranked.trafic_capte_estime,
      statut: 'en_attente_validation',
    },
  }
  const fs = require('fs')
  fs.writeFileSync('test-bloc4-result.json', JSON.stringify(result, null, 2))
  console.log('📁 Résultat exporté dans test-bloc4-result.json')
  */
}

main().catch((err) => {
  console.error('\n💥 Erreur fatale :', err.message)
  process.exit(1)
})
