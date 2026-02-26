require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  // Dernier audit lancé
  const { data: audit } = await sb.from('audits').select('id, statut, created_at, destination_id').order('created_at', { ascending: false }).limit(1).single()
  if (!audit) { console.log('Aucun audit trouvé'); return }

  const { data: dest } = await sb.from('destinations').select('nom').eq('id', audit.destination_id).single()
  console.log('=== Audit :', dest?.nom, '|', audit.id, '| statut:', audit.statut)
  console.log('=== Créé :', audit.created_at)
  console.log()

  // blocs_statuts
  const { data: auditFull } = await sb.from('audits').select('resultats').eq('id', audit.id).single()
  const blocs = auditFull?.resultats?.blocs_statuts
  if (blocs) {
    console.log('=== blocs_statuts :')
    Object.entries(blocs).forEach(([k, v]) => console.log('  ', k, ':', v))
    console.log()
  }

  // Inspecter les colonnes disponibles sur audit_logs
  const { data: sample } = await sb.from('audit_logs').select('*').eq('audit_id', audit.id).limit(1)
  if (sample && sample.length > 0) {
    console.log('=== Colonnes audit_logs :', Object.keys(sample[0]).join(', '))
    console.log()
  }

  // 40 derniers logs — colonnes génériques
  const { data: logs, error: logErr } = await sb.from('audit_logs').select('*').eq('audit_id', audit.id).order('created_at', { ascending: true }).limit(60)
  if (logErr) { console.log('Erreur logs:', logErr.message); return }
  console.log('=== Logs (' + (logs || []).length + ') :')
  ;(logs || []).forEach(l => {
    const ts = new Date(l.created_at).toLocaleTimeString('fr-FR')
    const detail = l.detail || l.details || l.data || l.meta || ''
    const detStr = detail ? ' ' + JSON.stringify(detail).slice(0, 150) : ''
    console.log('[' + ts + '] [' + (l.bloc || '-') + '] [' + (l.niveau || l.level || 'info') + '] ' + (l.message || l.msg || '') + detStr)
  })
}
main().catch(console.error)
