// Test complet Vue Score de visibilité — "les 7 laux" / les7laux.com
// Simule toutes les étapes de VisibilityView.handleAnalyze()
// Usage : node test-visibility.js

require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

const DATAFORSEO_LOGIN    = process.env.DATAFORSEO_LOGIN
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD
const HALOSCAN_API_KEY    = process.env.HALOSCAN_API_KEY
const OPENAI_API_KEY      = process.env.OPENAI_API_KEY

const AUTH = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')

const KEYWORD   = 'les 7 laux'
const DOMAIN    = 'les7laux.com'

function extractRootDomain(url) {
  try {
    const hostname = new URL(url).hostname
    const parts = hostname.replace('www.', '').split('.')
    return parts.slice(-2).join('.')
  } catch {
    return url
  }
}

async function testSerpMain() {
  console.log('\n=== 1. SERP PRINCIPAL ===')
  const res = await axios.post(
    'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
    [{ keyword: KEYWORD, language_code: 'fr', location_code: 2250, depth: 10, people_also_ask_click_depth: 1 }],
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' }, timeout: 60000 }
  )
  const items = res.data?.tasks?.[0]?.result?.[0]?.items ?? []
  const organics = items.filter(i => i.type === 'organic')
  const paa      = items.filter(i => i.type === 'people_also_ask')
  const kg       = items.find(i => i.type === 'knowledge_graph')
  const lp       = items.find(i => i.type === 'local_pack')

  console.log(`Organics : ${organics.length}`)
  organics.slice(0, 5).forEach(i => console.log(`  #${i.rank_absolute} ${i.domain} — ${i.title?.slice(0,60)}`))

  const ref = organics.find(i => (i.domain ?? '').includes(DOMAIN.replace('www.','')))
  console.log(`\nDomaine de référence (${DOMAIN}) : ${ref ? `#${ref.rank_absolute}` : 'ABSENT du top 10'}`)
  console.log(`PAA : ${paa.length} questions`)
  console.log(`Knowledge Graph : ${kg ? `OUI — "${kg.title}"` : 'non'}`)
  console.log(`Local Pack : ${lp ? `OUI (${lp.items?.length} entrées)` : 'non'}`)

  return { items, organics, paa, kg, lp }
}

async function testSerpCommercial(queries, section) {
  console.log(`\n=== 2. SERP COMMERCIALE — ${section.toUpperCase()} (${queries.length} requêtes) ===`)
  const results = await Promise.all(queries.map(async (q) => {
    try {
      const res = await axios.post(
        'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
        [{ keyword: q.keyword, language_code: 'fr', location_code: 2250, depth: 10 }],
        { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' }, timeout: 60000 }
      )
      const organics = (res.data?.tasks?.[0]?.result?.[0]?.items ?? []).filter(i => i.type === 'organic')
      console.log(`  "${q.keyword}" : ${organics.length} résultats, top=${organics[0]?.domain ?? 'vide'}`)
      return { query: q, organics }
    } catch(e) {
      console.log(`  "${q.keyword}" : ERREUR ${e.message}`)
      return { query: q, organics: [] }
    }
  }))

  // Consolidation
  const domainMap = new Map()
  for (const { query, organics } of results) {
    for (const item of organics) {
      const rootDomain = extractRootDomain(item.url ?? item.domain ?? '')
      const isRef = rootDomain.includes(DOMAIN.replace('www.',''))
      if (!domainMap.has(rootDomain)) {
        domainMap.set(rootDomain, { rootDomain, appearances: [], isRef })
      }
      domainMap.get(rootDomain).appearances.push({ serpId: query.id, position: item.rank_absolute })
      if (isRef) domainMap.get(rootDomain).isRef = true
    }
  }
  const totalSerps = queries.length
  const consolidated = Array.from(domainMap.values()).map(d => {
    const positions = d.appearances.map(a => a.position)
    return {
      ...d,
      avgPosition: positions.reduce((s,p) => s+p, 0) / positions.length,
      frequency: d.appearances.length,
      frequencyRatio: d.appearances.length / totalSerps,
    }
  }).sort((a,b) => a.avgPosition - b.avgPosition)

  console.log(`\n  Top 8 consolidé :`)
  consolidated.slice(0, 8).forEach((d, i) => {
    console.log(`  #${i+1} ${d.rootDomain} — pos.moy=${d.avgPosition.toFixed(1)}, présence ${d.frequency}/${totalSerps}${d.isRef ? ' ← VOUS' : ''}`)
  })

  const refRank = consolidated.findIndex(d => d.isRef)
  console.log(`  Rang domaine de référence : ${refRank === -1 ? 'ABSENT' : refRank + 1}`)

  return consolidated
}

async function testRelated() {
  console.log('\n=== 3. MOTS-CLÉS CONNEXES ===')
  const res = await axios.post(
    'https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live',
    [{ keyword: KEYWORD, language_code: 'fr', location_code: 2250, depth: 2, limit: 200, include_seed_keyword: true }],
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' }, timeout: 60000 }
  )
  const items = res.data?.tasks?.[0]?.result?.[0]?.items ?? []
  const filtered = items.filter(i => (i.keyword_data?.search_volume ?? 0) >= 100)
  console.log(`Total items : ${items.length} | Avec volume ≥ 100 : ${filtered.length}`)
  filtered.slice(0, 8).forEach(i => console.log(`  "${i.keyword_data?.keyword}" — vol ${i.keyword_data?.search_volume}`))
  return filtered
}

async function testRanked() {
  console.log('\n=== 4. MOTS-CLÉS POSITIONNÉS ===')
  const res = await axios.post(
    'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live',
    [{ target: DOMAIN, language_code: 'fr', location_code: 2250, limit: 1000, item_types: ['organic'] }],
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' }, timeout: 60000 }
  )
  const items = res.data?.tasks?.[0]?.result?.[0]?.items ?? []
  console.log(`Mots-clés positionnés : ${items.length}`)
  items.slice(0, 8).forEach(i => console.log(`  #${i.ranked_serp_element?.serp_item?.rank_absolute} "${i.keyword_data?.keyword}" — vol ${i.keyword_data?.search_volume}`))

  // Tâche status vérification
  const taskStatus = res.data?.tasks?.[0]?.status_message
  const taskCode   = res.data?.tasks?.[0]?.status_code
  if (taskCode !== 20000) {
    console.log(`  ⚠️ status_code=${taskCode} | message=${taskStatus}`)
  }
  return items
}

async function testClassify(domains) {
  console.log('\n=== 5. CLASSIFICATION GPT ===')
  const sample = domains.slice(0, 15)
  console.log(`Domaines à classifier (sample ${sample.length}) :`, sample)
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      max_completion_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: 'Classifie les domaines en OFFICIEL, INTERMEDIAIRE, MEDIA, INFORMATION. Réponds UNIQUEMENT avec un JSON valide : {"classifications":[{"domain":"string","type":"..."}]}'
        },
        {
          role: 'user',
          content: `Destination : ${KEYWORD}\nDomaines : ${JSON.stringify(sample)}`
        }
      ]
    },
    { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
  )
  const raw = res.data?.choices?.[0]?.message?.content ?? ''
  const finish = res.data?.choices?.[0]?.finish_reason
  console.log(`finish_reason: ${finish}`)
  console.log(`raw (200 chars): ${raw.slice(0,200)}`)

  try {
    const cleaned = raw.replace(/```json\n?|```/g, '').trim() || '{}'
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    console.log(`Classifications parsées : ${parsed.classifications?.length ?? 0}`)
    return parsed.classifications ?? []
  } catch(e) {
    console.log(`  ❌ Parse error : ${e.message}`)
    return []
  }
}

async function main() {
  console.log(`\n🔍 TEST VISIBILITÉ — "${KEYWORD}" / ${DOMAIN}`)
  console.log('='.repeat(50))

  try {
    // 1. SERP principal
    const { organics, paa, kg, lp } = await testSerpMain()

    // 2. SERPs commerciales
    const hebergQueries = [
      { id: 'serp1', label: 'hébergements',     keyword: `hébergements ${KEYWORD}` },
      { id: 'serp2', label: 'hébergement',       keyword: `hébergement ${KEYWORD}` },
      { id: 'serp3', label: 'location vacances', keyword: `location vacances ${KEYWORD}` },
      { id: 'serp4', label: 'hôtel',             keyword: `hotel ${KEYWORD}` },
      { id: 'serp5', label: 'camping',           keyword: `camping ${KEYWORD}` },
    ]
    const activitesQueries = [
      { id: 'serp1', label: 'que faire à',  keyword: `que faire à ${KEYWORD}` },
      { id: 'serp2', label: 'activités à',  keyword: `activités ${KEYWORD}` },
    ]

    const [hebergConsolidated, activitesConsolidated] = await Promise.all([
      testSerpCommercial(hebergQueries, 'hebergement'),
      testSerpCommercial(activitesQueries, 'activites'),
    ])

    // 3. Related keywords
    const related = await testRelated()

    // 4. Ranked keywords
    const ranked = await testRanked()

    // 5. Classification GPT
    const allDomains = [
      ...hebergConsolidated.map(d => d.rootDomain),
      ...activitesConsolidated.map(d => d.rootDomain),
    ].filter((d, i, arr) => arr.indexOf(d) === i)
    await testClassify(allDomains)

    // Résumé scores estimés
    console.log('\n=== RÉSUMÉ SCORES ESTIMÉS ===')
    const refPos = organics.find(i => (i.domain ?? '').includes(DOMAIN.replace('www.','')) )?.rank_absolute ?? null
    const hebergRank = hebergConsolidated.findIndex(d => d.isRef)
    const activitesRank = activitesConsolidated.findIndex(d => d.isRef)

    const posScore = refPos === null ? 0 : refPos === 1 ? 15 : refPos <= 3 ? 12 : refPos <= 5 ? 8 : refPos <= 10 ? 4 : 0
    const kgScore  = kg ? 5 : 0
    const lpScore  = lp ? 5 : 0
    const nominal  = Math.min(25, posScore + kgScore + lpScore)

    const hebergScore = hebergRank === -1 ? 0 : Math.max(0, 12 - hebergRank * 2)
    const activScore  = activitesRank === -1 ? 0 : Math.max(0, 13 - activitesRank * 3)
    const commercial  = Math.min(25, hebergScore + activScore)

    const rankedSet = new Set(ranked.map(r => r.keyword_data?.keyword?.toLowerCase()))
    const covered   = related.filter(r => rankedSet.has(r.keyword_data?.keyword?.toLowerCase())).length
    const semantic  = related.length > 0 ? Math.round((covered / related.length) * 25) : 0

    console.log(`Nominal    : ${nominal}/25 (pos=${refPos ?? 'absent'}, KG=${kg ? 'oui' : 'non'}, LP=${lp ? 'oui' : 'non'})`)
    console.log(`Commercial : ${commercial}/25 (héberg rang ${hebergRank === -1 ? 'absent' : hebergRank+1}, activités rang ${activitesRank === -1 ? 'absent' : activitesRank+1})`)
    console.log(`Sémantique : ${semantic}/25 (${covered}/${related.length} mots-clés couverts)`)
    console.log(`Total estimé (sans content) : ${nominal + commercial + semantic}/100`)

  } catch (err) {
    console.error('\n❌ ERREUR :', err.response?.data ?? err.message)
  }
}

main()
