// test-supabase.js — Validation connexion Supabase + structure tables + seed Annecy
// Usage : node scripts/test-supabase.js
// Prérequis : migrations 001-005 + seed.sql exécutés dans le SQL Editor Supabase

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const url         = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anon) {
  console.error('❌ Variables NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes dans .env.local')
  process.exit(1)
}

// Utiliser la service_role key si disponible (bypass RLS pour les tests)
// Sinon fallback sur la clé anon (RLS limitera les résultats)
const key = serviceRole || anon
if (serviceRole) console.log('🔑 Utilisation de la service_role key (bypass RLS)')
else console.log('⚠️  service_role key absente — utilisation clé anon (RLS actif, tables vides attendues)')

const supabase = createClient(url, key)

// ─── Helpers ──────────────────────────────────────────────────

function ok(label, value) {
  console.log(`  ✅ ${label}${value !== undefined ? ' : ' + value : ''}`)
}
function fail(label, err) {
  console.error(`  ❌ ${label} : ${err?.message || err}`)
}
function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(50 - title.length)}`)
}

// ─── Tests ────────────────────────────────────────────────────

async function testConnexion() {
  section('1. Connexion Supabase')
  try {
    // Simple ping via select count — ne nécessite pas RLS
    const { error } = await supabase.from('destinations').select('id', { count: 'exact', head: true })
    if (error) throw error
    ok('Connexion établie', url)
  } catch (e) {
    fail('Connexion', e)
    process.exit(1)
  }
}

async function testTables() {
  section('2. Tables accessibles (RLS anon)')

  // destinations
  const { data: dest, error: e1 } = await supabase
    .from('destinations')
    .select('id, nom, siren, code_insee, population')
    .limit(5)
  if (e1) fail('destinations', e1)
  else ok(`destinations — ${dest.length} ligne(s)`, dest.map(d => d.nom).join(', ') || '(vide)')

  // audits
  const { data: audits, error: e2 } = await supabase
    .from('audits')
    .select('id, statut, destination_id')
    .limit(5)
  if (e2) fail('audits', e2)
  else ok(`audits — ${audits.length} ligne(s)`, audits.map(a => a.statut).join(', ') || '(vide)')

  return { dest, audits }
}

async function testSeedAnnecy(auditId) {
  section('3. Seed Annecy — lecture JSONB blocs')

  if (!auditId) {
    console.log('  ⚠️  Aucun audit trouvé — seed pas encore exécuté dans Supabase')
    return
  }

  const { data, error } = await supabase
    .from('audits')
    .select('resultats, couts_api')
    .eq('id', auditId)
    .single()

  if (error) { fail('lecture audit', error); return }

  const r = data.resultats
  const c = data.couts_api

  // Bloc 1
  const ot = r?.positionnement?.google?.ot
  if (ot?.note) ok('Bloc 1 — note Google OT', `${ot.note}/5 (${ot.avis} avis)`)
  else fail('Bloc 1 — note Google OT', 'champ absent')

  const ig = r?.positionnement?.instagram
  if (ig?.posts_count) ok('Bloc 1 — Instagram posts_count', ig.posts_count.toLocaleString('fr-FR'))
  else fail('Bloc 1 — Instagram', 'champ absent')

  // Bloc 2
  const ts = r?.volume_affaires?.collecteur
  if (ts?.montant_taxe_euros) ok('Bloc 2 — taxe de séjour', `${ts.montant_taxe_euros.toLocaleString('fr-FR')} €`)
  else fail('Bloc 2 — taxe de séjour', 'champ absent')

  // Bloc 3
  const haloscan = r?.schema_digital?.haloscan?.[0]
  if (haloscan?.total_keywords) ok('Bloc 3 — keywords lac-annecy.com', haloscan.total_keywords.toLocaleString('fr-FR'))
  else fail('Bloc 3 — Haloscan', 'champ absent')

  const score = r?.schema_digital?.score_visibilite_ot
  if (score !== undefined) ok('Bloc 3 — score visibilité OT', `${score}/5`)
  else fail('Bloc 3 — score visibilité OT', 'champ absent')

  // Bloc 4
  const phaseB = r?.visibilite_seo?.phase_b
  if (phaseB?.score_gap !== undefined) ok('Bloc 4 — score gap', `${phaseB.score_gap}/10`)
  else fail('Bloc 4 — score gap', 'champ absent')

  if (phaseB?.top_5_opportunites?.length) {
    ok('Bloc 4 — top opportunité', `"${phaseB.top_5_opportunites[0].keyword}" (${phaseB.top_5_opportunites[0].volume} req/mois)`)
  }

  // Bloc 5
  const stocks = r?.stocks_physiques?.stocks
  if (stocks?.total_stock_physique) ok('Bloc 5 — stock physique total', stocks.total_stock_physique.toLocaleString('fr-FR'))
  else fail('Bloc 5 — stocks', 'champ absent')

  // Bloc 6
  const airbnb = r?.stock_en_ligne?.airbnb
  if (airbnb?.total_annonces !== undefined) ok('Bloc 6 — Airbnb annonces', airbnb.total_annonces.toLocaleString('fr-FR'))
  else fail('Bloc 6 — Airbnb', 'champ absent')

  // Bloc 7
  const synthese = r?.concurrents?.synthese
  if (synthese?.position_globale) ok('Bloc 7 — position globale', synthese.position_globale)
  else fail('Bloc 7 — synthèse concurrents', 'champ absent')

  const nbConc = r?.concurrents?.concurrents_valides?.length
  if (nbConc) ok('Bloc 7 — concurrents validés', `${nbConc}`)

  // Coûts
  if (c?.total_audit !== undefined) ok('Coûts — total audit', `${c.total_audit} €`)
}

async function testConstrainteUnique() {
  section('4. Contrainte UNIQUE destination_id sur audits')

  // Récupérer le destination_id du seed
  const { data: dest } = await supabase
    .from('destinations')
    .select('id')
    .eq('siren', '200063402')
    .single()

  if (!dest) {
    console.log('  ⚠️  Destination Annecy absente — seed pas encore exécuté')
    return
  }

  // Tenter d'insérer un second audit sur la même destination
  const { error } = await supabase
    .from('audits')
    .insert({ destination_id: dest.id, statut: 'en_cours' })

  if (error && (error.code === '23505' || error.message?.includes('unique'))) {
    ok('Contrainte UNIQUE active — doublon refusé correctement')
  } else if (error) {
    fail('Contrainte UNIQUE', `erreur inattendue : ${error.message}`)
  } else {
    fail('Contrainte UNIQUE', 'INSERT a réussi — contrainte absente ou seed pas chargé')
  }
}

// ─── Main ─────────────────────────────────────────────────────

;(async () => {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║      Test Supabase — Destination Digital Audit      ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`Projet : ${url}`)

  await testConnexion()
  const { audits } = await testTables()

  const annecyAudit = audits?.find(a => true) // premier audit disponible
  await testSeedAnnecy(annecyAudit?.id)
  await testConstrainteUnique()

  console.log('\n── Terminé ─────────────────────────────────────────────\n')
})()
