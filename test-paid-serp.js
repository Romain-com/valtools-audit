// Test DataForSEO paid SERP endpoint
// Usage: node test-paid-serp.js
require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

const LOGIN = process.env.DATAFORSEO_LOGIN
const PASSWORD = process.env.DATAFORSEO_PASSWORD
const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64')

async function testPaid() {
  const keyword = 'hebergement les 7 laux'

  console.log(`\nTest keyword: "${keyword}"`)
  console.log('Endpoint: /serp/google/paid/live/advanced\n')

  try {
    const res = await axios.post(
      'https://api.dataforseo.com/v3/serp/google/paid/live/advanced',
      [{ keyword, language_code: 'fr', location_code: 2250, depth: 10 }],
      {
        headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' },
        timeout: 60_000,
      }
    )

    const task = res.data?.tasks?.[0]
    console.log('status_code:', task?.status_code)
    console.log('status_message:', task?.status_message)

    const items = task?.result?.[0]?.items ?? []
    console.log('items count:', items.length)

    if (items.length === 0) {
      console.log('\n→ Aucun item retourné.')
      console.log('Full task result:', JSON.stringify(task?.result, null, 2))
    } else {
      console.log('\nItem types:', [...new Set(items.map(i => i.type))])
      console.log('\nFirst item:')
      console.log(JSON.stringify(items[0], null, 2))
      console.log('\nAll items (domain + type + title):')
      items.forEach((item, i) => {
        console.log(`  ${i+1}. [${item.type}] ${item.domain} — ${item.title?.substring(0, 60)}`)
      })
    }
  } catch (err) {
    console.error('Erreur axios:', err.response?.status, err.response?.data ?? err.message)
  }
}

testPaid()
