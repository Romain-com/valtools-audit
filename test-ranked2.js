require('dotenv').config({ path: '.env.local' })
const axios = require('./node_modules/axios')

const AUTH = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64')

const CTR = { 1:0.28, 2:0.15, 3:0.11, 4:0.08, 5:0.07, 6:0.05, 7:0.04, 8:0.03, 9:0.03, 10:0.02 }
function ctr(pos) {
  if (pos <= 0) return 0
  if (pos <= 10) return CTR[pos] ?? 0.02
  if (pos <= 20) return 0.01
  return 0.005
}

async function test() {
  const res = await axios.post(
    'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live',
    [{ target: 'alpedhuez.com', language_code: 'fr', location_code: 2250, limit: 1000, item_types: ['organic'] }],
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' }, timeout: 60000 }
  )

  const items = res.data?.tasks?.[0]?.result?.[0]?.items ?? []
  const keywords = items.map(it => {
    const pos = it.ranked_serp_element?.serp_item?.rank_absolute ?? 0
    const vol = it.keyword_data?.keyword_info?.search_volume ?? 0
    return {
      keyword: it.keyword_data?.keyword,
      position: pos,
      searchVolume: vol,
      etv: Math.round(vol * ctr(pos)),
      url: it.ranked_serp_element?.serp_item?.url,
    }
  })

  // ETV par URL
  const etvParUrl = {}
  for (const k of keywords) {
    if (!k.url) continue
    etvParUrl[k.url] = (etvParUrl[k.url] ?? 0) + k.etv
  }
  const urlPrincipale = Object.entries(etvParUrl).sort((a,b) => b[1]-a[1])[0]
  console.log(`\nTotal keywords: ${keywords.length}`)
  console.log(`\nURL principale (ETV total: ${urlPrincipale?.[1]}):`)
  console.log(urlPrincipale?.[0])

  const top20 = keywords
    .filter(k => k.url === urlPrincipale?.[0])
    .sort((a,b) => b.etv - a.etv)
    .slice(0, 20)

  console.log(`\n--- Top 20 mots-clés (${top20.length}) ---`)
  top20.forEach(k => console.log(`  [${k.position}] ${k.keyword} — vol:${k.searchVolume} etv:${k.etv}`))
}
test().catch(console.error)
