// Test croisement opportunités — "les 7 laux" / les7laux.com
// Simule exactement ce que font les routes ranked + related + SectionSemantic

require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

const KEY = process.env.HALOSCAN_API_KEY
const KEYWORD = 'les 7 laux'
const DOMAIN = 'les7laux.com'

function norm(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ').sort().join(' ')
}

// --- Étape 1 : tous les mots-clés liés au keyword (keywords/match paginé) ---
async function fetchRelated() {
  const all = []
  let page = 1
  while (page <= 15) {
    const r = await axios.post('https://api.haloscan.com/api/keywords/match',
      { keyword: KEYWORD, lineCount: 200, page, order_by: 'volume', order: 'desc', volume_min: 10, exact_match: false },
      { headers: { 'haloscan-api-key': KEY, 'Content-Type': 'application/json' }, timeout: 30000 }
    )
    const results = r.data?.results ?? []
    all.push(...results)
    process.stdout.write(`  [related] page ${page} — ${results.length} résultats (total cumulé: ${all.length}, remaining: ${r.data?.remaining_result_count})\n`)
    if (results.length < 200 || r.data?.remaining_result_count === 0) break
    page++
  }
  return all
}

// --- Étape 2 : tous les mots-clés du domaine (domains/positions paginé) ---
async function fetchRanked() {
  const all = []
  let page = 1
  while (page <= 60) {
    const r = await axios.post('https://api.haloscan.com/api/domains/positions',
      { input: DOMAIN, mode: 'root', lineCount: 500, page, order_by: 'traffic', order: 'desc' },
      { headers: { 'haloscan-api-key': KEY, 'Content-Type': 'application/json' }, timeout: 30000 }
    )
    const results = r.data?.results ?? []
    const totalKw = r.data?.total_keyword_count ?? 0
    all.push(...results)
    process.stdout.write(`  [ranked] page ${page} — ${results.length} résultats (total cumulé: ${all.length}/${totalKw})\n`)
    if (results.length < 500 || all.length >= totalKw) break
    page++
  }
  return all
}

async function main() {
  console.log(`\n🔍 Keyword seed : "${KEYWORD}"`)
  console.log(`🌐 Domaine      : ${DOMAIN}\n`)

  console.log('--- Étape 1 : récupération des mots-clés liés ---')
  const related = await fetchRelated()
  console.log(`→ ${related.length} mots-clés liés\n`)

  console.log('--- Étape 2 : récupération des positions du domaine ---')
  const ranked = await fetchRanked()
  console.log(`→ ${ranked.length} positions récupérées\n`)

  // --- Étape 3 : croisement ---
  const rankedSet = new Set(ranked.map(r => norm(r.keyword)))

  const covered = related.filter(rk => rankedSet.has(norm(rk.keyword)))
  const missing = related
    .filter(rk => !rankedSet.has(norm(rk.keyword)))
    .sort((a, b) => Number(b.volume) - Number(a.volume))
    .slice(0, 20)

  const coveragePercent = related.length > 0 ? Math.round(covered.length / related.length * 100) : 0

  console.log('--- Résultat ---')
  console.log(`Couverts  : ${covered.length} / ${related.length} (${coveragePercent}%)`)
  console.log(`Manquants : ${related.length - covered.length}`)
  console.log('\n--- TOP 20 opportunités manquées (triées par volume) ---\n')

  missing.forEach((rk, i) => {
    console.log(`[${String(i+1).padStart(2)}] ${rk.keyword}`)
    console.log(`      volume: ${rk.volume} | cpc: ${rk.cpc} | competition: ${rk.competition}`)
  })
}

main().catch(err => {
  console.error('Erreur :', err.response?.data ?? err.message)
  process.exit(1)
})
