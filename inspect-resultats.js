require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

sb.from('audits').select('resultats').order('created_at', { ascending: false }).limit(1).single().then(({ data }) => {
  const r = data.resultats || {}
  const keys = Object.keys(r)
  console.log('Clés top-level resultats:', keys.join(', '))
  keys.forEach(k => {
    const v = r[k]
    if (v && typeof v === 'object' && Array.isArray(v) === false) {
      console.log('  [' + k + '] sous-clés:', Object.keys(v).join(', '))
    } else {
      console.log('  [' + k + '] :', JSON.stringify(v).slice(0, 80))
    }
  })
}).catch(console.error)
