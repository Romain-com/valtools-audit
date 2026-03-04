require('dotenv').config({ path: '.env.local' })
const axios = require('./node_modules/axios')

const AUTH = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64')

async function test() {
  const res = await axios.post(
    'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live',
    [{ target: 'alpedhuez.com', language_code: 'fr', location_code: 2250, limit: 10, item_types: ['organic'] }],
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' }, timeout: 60000 }
  )

  const items = res.data?.tasks?.[0]?.result?.[0]?.items ?? []
  console.log(`Total items: ${items.length}`)
  console.log('\n--- Clés racine du 1er item ---')
  if (items[0]) console.log(Object.keys(items[0]))
  console.log('\n--- 3 premiers items ---')
  items.slice(0, 3).forEach(it => {
    console.log({
      keyword: it.keyword_data?.keyword,
      etv: it.etv,
      searchVolume: it.keyword_data?.keyword_info?.search_volume,
      position: it.ranked_serp_element?.serp_item?.rank_absolute,
      url: it.ranked_serp_element?.serp_item?.url,
    })
  })
}
test().catch(console.error)
