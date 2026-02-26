require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  // Trouver la destination Courchevel
  const { data: dest } = await sb.from('destinations').select('id, nom, siren').eq('nom', 'Courchevel').single()
  if (!dest) { console.log('Destination Courchevel non trouvée'); return }
  console.log('Destination trouvée :', dest.nom, '| id :', dest.id)

  // Trouver les audits liés
  const { data: audits } = await sb.from('audits').select('id').eq('destination_id', dest.id)
  const auditIds = (audits || []).map(a => a.id)
  console.log('Audits trouvés :', auditIds.length, auditIds)

  // Supprimer les logs
  if (auditIds.length > 0) {
    const { error: logErr, count: logCount } = await sb.from('audit_logs').delete({ count: 'exact' }).in('audit_id', auditIds)
    if (logErr) console.error('Erreur suppression logs :', logErr.message)
    else console.log('Logs supprimés :', logCount)
  }

  // Supprimer les audits
  if (auditIds.length > 0) {
    const { error: audErr, count: audCount } = await sb.from('audits').delete({ count: 'exact' }).in('id', auditIds)
    if (audErr) console.error('Erreur suppression audits :', audErr.message)
    else console.log('Audits supprimés :', audCount)
  }

  // Supprimer la destination
  const { error: destErr, count: destCount } = await sb.from('destinations').delete({ count: 'exact' }).eq('id', dest.id)
  if (destErr) console.error('Erreur suppression destination :', destErr.message)
  else console.log('Destination supprimée :', destCount)

  console.log('\n✅ Nettoyage Courchevel terminé')
}
main().catch(console.error)
