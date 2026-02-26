require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function n(v) { return v == null ? 'n/a' : v }
function euro(v) { return v == null ? 'n/a' : Number(v).toLocaleString('fr-FR') + ' €' }
function nb(v) { return v == null ? 'n/a' : Number(v).toLocaleString('fr-FR') }

async function main() {
  const { data: audit } = await sb.from('audits').select('id, statut, created_at, destination_id, resultats').order('created_at', { ascending: false }).limit(1).single()
  if (!audit) { console.log('Aucun audit trouvé'); return }

  const { data: dest } = await sb.from('destinations').select('nom, code_insee, siren').eq('id', audit.destination_id).single()
  const r = audit.resultats || {}

  console.log('═══════════════════════════════════════════════════')
  console.log('BILAN AUDIT — ' + dest?.nom + ' (' + dest?.code_insee + ') | SIREN : ' + dest?.siren)
  console.log('Statut : ' + audit.statut + ' | ' + new Date(audit.created_at).toLocaleString('fr-FR'))
  console.log('═══════════════════════════════════════════════════\n')

  // ── BLOCS STATUTS
  const bs = r.blocs_statuts || {}
  console.log('── BLOCS STATUTS')
  const statuts = ['bloc1','bloc2','bloc3','bloc4','bloc5','bloc6','bloc7']
  statuts.forEach(k => {
    const icon = bs[k] === 'termine' ? '✅' : bs[k] === 'erreur' ? '❌' : bs[k] === 'en_attente_validation' ? '⏳' : '🔄'
    console.log('  ' + icon + ' ' + k + ' : ' + (bs[k] || 'en_attente'))
  })
  console.log()

  // ── BLOC 1 — Positionnement
  const b1 = r.positionnement
  if (b1) {
    console.log('── BLOC 1 — Positionnement & Notoriété')
    const maps = b1.google
    console.log('  Note OT Google Maps : ' + n(maps?.note_globale) + ' / 5 (' + nb(maps?.nb_avis) + ' avis)')
    console.log('  Instagram #' + (b1.instagram?.hashtag_utilise || '?') + ' : ' + nb(b1.instagram?.posts_count) + ' posts')
    if (b1.positionnement) {
      console.log('  Axe principal : ' + n(b1.positionnement.axe_principal))
      console.log('  Diagnostic : ' + (b1.positionnement.diagnostic || '').slice(0, 120))
    }
    if (b1.couts_bloc) console.log('  Coût : ' + b1.couts_bloc + ' €')
    console.log()
  }

  // ── BLOC 2 — Volume d'affaires
  const b2 = r.volume_affaires
  if (b2) {
    console.log('── BLOC 2 — Volume d\'affaires')
    const col = b2.collecteur
    console.log('  Taxe de séjour : ' + euro(col?.montant_taxe_euros) + ' | ' + n(col?.type_collecteur))
    console.log('  Nuitées estimées : ' + nb(col?.nuitees_estimees))
    console.log('  Taxe non instituée : ' + n(b2.taxe_non_instituee))
    console.log('  diagnostic_epci : ' + n(b2.diagnostic_epci))
    if (b2.dispatch_ts) {
      const dt = b2.dispatch_ts
      console.log('  Mélodi — total établissements TS : ' + nb(dt?.total_etablissements))
    }
    if (b2.meta?.erreurs_partielles?.length) console.log('  ⚠️  Erreurs : ' + b2.meta.erreurs_partielles.join(' | '))
    console.log()
  }

  // ── BLOC 3 — Schéma digital
  const b3 = r.schema_digital
  if (b3) {
    console.log('── BLOC 3 — Schéma digital')
    console.log('  Domaine OT détecté : ' + (b3.domaine_ot_detecte || '❌ NON DÉTECTÉ'))
    console.log('  Score visibilité OT : ' + n(b3.score_visibilite_ot) + ' / 10')
    console.log('  SERP fusionné : ' + (b3.serp_fusionne?.length || 0) + ' résultats')
    const hs = b3.haloscan
    if (hs && hs.statut !== 'non_indexe') {
      console.log('  Haloscan trafic estimé : ' + nb(hs?.total_traffic) + ' | DA : ' + n(hs?.domain_authority))
    } else {
      console.log('  Haloscan : ' + (hs?.statut || 'n/a'))
    }
    const ps = b3.pagespeed
    if (ps) console.log('  PageSpeed mobile : ' + n(ps.mobile?.score) + ' | desktop : ' + n(ps.desktop?.score))
    const ot = b3.analyse_site_ot
    if (ot) console.log('  Site OT : moteur resa = ' + n(ot.moteur_resa_detecte) + ' | score fonctionnalites = ' + n(ot.score_fonctionnalites))
    if (b3.meta?.erreurs_partielles?.length) console.log('  ⚠️  Erreurs : ' + b3.meta.erreurs_partielles.join(' | '))
    console.log()
  }

  // ── BLOC 4 — Visibilité SEO
  const b4 = r.visibilite_seo
  if (b4) {
    console.log('── BLOC 4 — Visibilité SEO')
    const pa = b4.phase_a
    if (pa) {
      console.log('  Phase A — keywords classés : ' + nb(pa.keywords_classes?.length))
      console.log('  Phase A — gaps : ' + nb(pa.gaps?.length) + ' (dont transac : ' + nb(pa.gaps_transac?.length) + ')')
    }
    const pb = b4.phase_b
    if (pb) {
      const sy = pb.synthese
      console.log('  Phase B — taux captation : ' + n(sy?.taux_captation) + '%')
      console.log('  Phase B — score gap : ' + n(sy?.score_gap) + ' / 10')
      console.log('  Phase B — opportunités top 5 : ' + n(sy?.nb_top5_opportunites))
    }
    console.log()
  }

  // ── BLOC 5 — Stocks physiques
  const b5 = r.stocks_physiques
  if (b5) {
    console.log('── BLOC 5 — Stocks physiques')
    const st = b5.stocks
    console.log('  Hébergements DATA Tourisme : ' + nb(st?.hebergements?.total))
    console.log('  Activités DATA Tourisme : ' + nb(st?.activites?.total))
    if (b5.meta?.erreurs_partielles?.length) console.log('  ⚠️  Erreurs : ' + b5.meta.erreurs_partielles.join(' | '))
    console.log()
  }

  // ── BLOC 6 — Stock en ligne
  const b6 = r.stock_en_ligne
  if (b6) {
    console.log('── BLOC 6 — Stock en ligne')
    console.log('  Airbnb : ' + nb(b6.airbnb?.total_annonces) + ' annonces | bbox : ' + (b6.airbnb?.bbox_utilisee ? 'oui ✅' : 'non — mode nom de ville'))
    console.log('  Booking : ' + nb(b6.booking?.total_proprietes) + ' propriétés')
    const bd = b6.booking?.detail
    if (bd) console.log('    → hotels:' + n(bd.hotels) + ' apparts:' + n(bd.apparts) + ' campings:' + n(bd.campings) + ' bb:' + n(bd.bb) + ' villas:' + n(bd.villas))
    console.log('  Viator : ' + nb(b6.viator?.total_activites) + ' activités | url : ' + (b6.viator?.url_utilisee || 'n/a').slice(0, 60))
    const ot = b6.site_ot
    if (ot) {
      console.log('  Site OT hébergements : ' + nb(ot.hebergements?.nb_fiches) + ' fiches (' + n(ot.hebergements?.type) + ')')
      console.log('  Site OT activités    : ' + nb(ot.activites?.nb_fiches) + ' fiches (' + n(ot.activites?.type) + ')')
      console.log('  Site OT moteur resa  : ' + n(ot.moteur_resa_detecte))
    }
    const ind = b6.indicateurs
    if (ind) {
      console.log('  Taux dépendance OTA   : ' + n(ind.taux_dependance_ota) + '%')
      console.log('  Taux réservable direct: ' + n(ind.taux_reservable_direct) + '%')
      console.log('  Taux visibilité activ.: ' + n(ind.taux_visibilite_activites) + '%')
      console.log('  Total OTA hébergements: ' + nb(ind.total_ota_hebergements))
    }
    if (b6.meta?.erreurs_partielles?.length) console.log('  ⚠️  Erreurs : ' + b6.meta.erreurs_partielles.join(' | '))
    console.log()
  } else {
    console.log('── BLOC 6 — Stock en ligne : aucune donnée\n')
  }

  // ── BLOC 7 — Concurrents
  const b7 = r.concurrents
  if (b7) {
    console.log('── BLOC 7 — Concurrents')
    const conc = b7.phase_a?.concurrents || b7.concurrents_valides || []
    conc.forEach(c => console.log('  - ' + c.nom + ' | ' + (c.domaine || c.url || '') + ' | type : ' + c.type))
    const metriques = b7.phase_b?.metriques || []
    if (metriques.length) {
      console.log('  Métriques (phase B) :')
      metriques.forEach(m => {
        const trafic = m.haloscan?.total_traffic ?? m.trafic_estime ?? 'n/a'
        console.log('    - ' + (m.nom || m.domaine) + ' | trafic : ' + nb(trafic) + ' | score : ' + n(m.score_global))
      })
    }
    if (b7.synthese) console.log('  Diagnostic : ' + (b7.synthese.diagnostic || '').slice(0, 120))
    if (b7.meta?.erreurs_partielles?.length) console.log('  ⚠️  Erreurs : ' + b7.meta.erreurs_partielles.join(' | '))
    console.log()
  } else {
    console.log('── BLOC 7 — Concurrents : aucune donnée\n')
  }

  // ── BBOX
  console.log('── BBOX PREFETCHÉE : ' + (r.bbox ? JSON.stringify(r.bbox) : 'non sauvegardée (audit lancé avant le prefetch)'))
  console.log()

  // ── ERREURS LOGS
  const { data: errLogs } = await sb.from('audit_logs').select('*').eq('audit_id', audit.id).eq('niveau', 'error').order('created_at', { ascending: true })
  if (errLogs && errLogs.length > 0) {
    console.log('── ERREURS LOGS')
    errLogs.forEach(l => {
      const ts = new Date(l.created_at).toLocaleTimeString('fr-FR')
      console.log('  [' + ts + '] [' + (l.bloc || '-') + '] ' + l.message)
      if (l.detail) console.log('    ' + JSON.stringify(l.detail).slice(0, 200))
    })
  } else {
    console.log('── ERREURS LOGS : aucune ✅')
  }
}
main().catch(console.error)
