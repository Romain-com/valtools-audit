// Test brut Haloscan domains/positions — affiche la réponse RAW pour comparer avec l'interface
// Usage : node test-haloscan-positions.js [domaine]
// Exemple : node test-haloscan-positions.js gresse-en-vercors.fr

require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

const HALOSCAN_API_KEY = process.env.HALOSCAN_API_KEY
const domain = (process.argv[2] || 'gresse-en-vercors.fr').replace(/^https?:\/\/(www\.)?/, '').split('/')[0]

async function main() {
  console.log(`\n🔍 Haloscan domains/positions — domaine: "${domain}"\n`)

  const response = await axios.post(
    'https://api.haloscan.com/api/domains/positions',
    {
      input: domain,
      mode: 'root',
      lineCount: 500,
      order_by: 'traffic',
      order: 'desc',
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
  console.log('total_keyword_count   :', data.total_keyword_count)
  console.log('total_result_count    :', data.total_result_count)
  console.log('returned_result_count :', data.returned_result_count)
  console.log('failure_reason        :', data.failure_reason)
  console.log('response_code         :', data.response_code)
  console.log()

  const results = data.results ?? []
  console.log(`--- ${results.length} résultats retournés ---`)
  console.log()

  results.forEach((r, i) => {
    console.log(`[${String(i + 1).padStart(2)}] keyword: "${r.keyword}"`)
    console.log(`      url: ${r.url}`)
    console.log(`      position: ${r.position} | volume: ${r.volume} | traffic: ${r.traffic}`)
    console.log()
  })

  if (results[0]) {
    console.log('--- Champs disponibles sur results[0] ---')
    console.log(Object.keys(results[0]).join(', '))
  }
}

main().catch(err => {
  console.error('Erreur :', err.response?.data ?? err.message)
  process.exit(1)
})
