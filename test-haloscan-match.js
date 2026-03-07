// Test brut Haloscan keywords/match — affiche la réponse RAW pour comparer avec l'interface
// Usage : node test-haloscan-match.js [keyword]
// Exemple : node test-haloscan-match.js "les 7 laux"

require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

const HALOSCAN_API_KEY = process.env.HALOSCAN_API_KEY
const keyword = process.argv[2] || 'les 7 laux'

async function main() {
  console.log(`\n🔍 Haloscan keywords/match — keyword: "${keyword}"\n`)

  const response = await axios.post(
    'https://api.haloscan.com/api/keywords/match',
    {
      keyword,
      lineCount: 200,
      order_by: 'volume',
      order: 'desc',
      volume_min: 10,
      exact_match: false,
    },
    {
      headers: {
        'haloscan-api-key': HALOSCAN_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    }
  )

  const data = response.data
  console.log('--- Méta ---')
  console.log('total_result_count    :', data.total_result_count)
  console.log('filtered_result_count :', data.filtered_result_count)
  console.log('returned_result_count :', data.returned_result_count)
  console.log('failure_reason        :', data.failure_reason)
  console.log('response_code         :', data.response_code)
  console.log()

  const results = data.results ?? []
  console.log(`--- ${results.length} résultats retournés ---`)
  console.log()

  // Affiche les 20 premiers avec tous les champs
  results.slice(0, 20).forEach((r, i) => {
    console.log(`[${String(i + 1).padStart(2)}] keyword: "${r.keyword}"`)
    console.log(`      volume: ${r.volume} | cpc: ${r.cpc} | competition: ${r.competition} | kgr: ${r.kgr}`)
    console.log(`      allintitle: ${r.allintitle} | word_count: ${r.word_count}`)
    console.log()
  })

  // Résumé des champs disponibles sur le 1er résultat
  if (results[0]) {
    console.log('--- Champs disponibles sur results[0] ---')
    console.log(Object.keys(results[0]).join(', '))
  }
}

main().catch(err => {
  console.error('Erreur :', err.response?.data ?? err.message)
  process.exit(1)
})
