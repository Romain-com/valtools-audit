// Segment A — Blocs 1 → 2 → 3 → 4 Phase A
// Déclenché automatiquement dès qu'un audit passe en statut 'en_cours'
// Se termine en statut 'en_attente_validation' sur le Bloc 4
//
// ⚠️ runtime 'nodejs' obligatoire — Bloc 6 (Segment B) utilise Playwright
// ⚠️ maxDuration = 300 — les blocs peuvent prendre jusqu'à 5 min au total

export const runtime = 'nodejs'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { lancerBloc1 } from '@/lib/orchestrateur/wrappers/bloc1'
import { lancerBloc2 } from '@/lib/orchestrateur/wrappers/bloc2'
import { lancerBloc3 } from '@/lib/orchestrateur/wrappers/bloc3'
import { lancerBloc4PhaseA } from '@/lib/orchestrateur/wrappers/bloc4'
import { logInfo, logError } from '@/lib/orchestrateur/logger'
import {
  mettreAJourBloc,
  mettreAJourStatutAudit,
  lireParamsAudit,
  lireDomaineOT,
  initialiserBlocsStatutsEnBase,
  lireBlocsStatuts,
} from '@/lib/orchestrateur/supabase-updates'
import { initialiserBlocsStatuts } from '@/lib/orchestrateur/blocs-statuts'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Variables Supabase manquantes')
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  try {
    const { audit_id } = await req.json() as { audit_id: string }

    if (!audit_id) {
      return NextResponse.json({ error: 'audit_id requis' }, { status: 400 })
    }

    // ── Vérification : l'audit existe et est en cours ──────────────────────────
    const supabase = getSupabase()
    const { data: audit, error } = await supabase
      .from('audits')
      .select('id, statut, resultats')
      .eq('id', audit_id)
      .single()

    if (error || !audit) {
      return NextResponse.json({ error: 'Audit introuvable' }, { status: 404 })
    }

    if (audit.statut !== 'en_cours') {
      return NextResponse.json(
        { error: `Statut invalide : ${audit.statut}` },
        { status: 409 }
      )
    }

    // ── Idempotence : ne pas relancer si blocs_statuts déjà initialisés et actifs ──
    const blocsExistants = await lireBlocsStatuts(audit_id)
    const dejaLance = blocsExistants.bloc1 && blocsExistants.bloc1 !== 'en_attente'
    if (dejaLance) {
      return NextResponse.json({
        message: 'Segment A déjà en cours ou terminé',
        statut: blocsExistants.bloc4,
      })
    }

    // ── Lecture des paramètres de la destination ───────────────────────────────
    const params = await lireParamsAudit(audit_id)

    // ── Init blocs_statuts — tous 'en_attente' ─────────────────────────────────
    await initialiserBlocsStatutsEnBase(audit_id, initialiserBlocsStatuts())
    await logInfo(audit_id, 'Segment A démarré', undefined, {
      destination: params.nom,
      code_insee: params.code_insee,
    })

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOC 1 — Positionnement & Notoriété
    // ─────────────────────────────────────────────────────────────────────────────
    await logInfo(audit_id, 'Bloc 1 démarré', 'bloc1')
    await mettreAJourBloc(audit_id, 'bloc1', 'en_cours')

    const debut1 = Date.now()
    try {
      const resultat1 = await lancerBloc1(params)
      await mettreAJourBloc(audit_id, 'bloc1', 'termine', resultat1.resultats, resultat1.couts)
      await logInfo(audit_id, 'Bloc 1 terminé', 'bloc1', {
        duree_ms: Date.now() - debut1,
        cout: resultat1.couts.total,
      })
    } catch (err) {
      await mettreAJourBloc(audit_id, 'bloc1', 'erreur')
      await logError(audit_id, 'Bloc 1 échoué', 'bloc1', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        params: { destination: params.nom, code_insee: params.code_insee },
      })
      // Erreur non bloquante — on continue
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOC 2 — Volume d'affaires
    // ─────────────────────────────────────────────────────────────────────────────
    await logInfo(audit_id, 'Bloc 2 démarré', 'bloc2')
    await mettreAJourBloc(audit_id, 'bloc2', 'en_cours')

    const debut2 = Date.now()
    try {
      const resultat2 = await lancerBloc2(params)
      await mettreAJourBloc(audit_id, 'bloc2', 'termine', resultat2.resultats, resultat2.couts)
      await logInfo(audit_id, 'Bloc 2 terminé', 'bloc2', {
        duree_ms: Date.now() - debut2,
        cout: resultat2.couts.total,
      })
    } catch (err) {
      await mettreAJourBloc(audit_id, 'bloc2', 'erreur')
      await logError(audit_id, 'Bloc 2 échoué', 'bloc2', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        params: { destination: params.nom, siren: params.siren },
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOC 3 — Schéma digital & Santé technique
    // ─────────────────────────────────────────────────────────────────────────────
    await logInfo(audit_id, 'Bloc 3 démarré', 'bloc3')
    await mettreAJourBloc(audit_id, 'bloc3', 'en_cours')

    const debut3 = Date.now()
    try {
      const resultat3 = await lancerBloc3(params)
      await mettreAJourBloc(audit_id, 'bloc3', 'termine', resultat3.resultats, resultat3.couts)
      await logInfo(audit_id, 'Bloc 3 terminé', 'bloc3', {
        duree_ms: Date.now() - debut3,
        cout: resultat3.couts.total,
        domaine_ot: (resultat3.resultats as Record<string, unknown>).domaine_ot_detecte,
      })
    } catch (err) {
      await mettreAJourBloc(audit_id, 'bloc3', 'erreur')
      await logError(audit_id, 'Bloc 3 échoué', 'bloc3', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        params: { destination: params.nom },
      })
    }

    // ── Lire domaine_ot APRÈS sauvegarde Bloc 3 ────────────────────────────────
    const domaine_ot = await lireDomaineOT(audit_id)
    await logInfo(audit_id, 'domaine_ot résolu après Bloc 3', 'orchestrateur', {
      domaine_ot,
      source: domaine_ot ? 'bloc3_detecte' : 'null — OT non détecté dans le SERP',
    })

    // ── Recharger les params complets avec domaine_ot maintenant disponible ───
    const paramsAvecDomaine = await lireParamsAudit(audit_id)

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOC 4 Phase A — Visibilité SEO & Gap
    // ─────────────────────────────────────────────────────────────────────────────
    await logInfo(audit_id, 'Bloc 4 Phase A démarré', 'bloc4')
    await mettreAJourBloc(audit_id, 'bloc4', 'en_cours')

    const debut4 = Date.now()
    try {
      const resultat4a = await lancerBloc4PhaseA(paramsAvecDomaine)

      // Statut en_attente_validation après Phase A
      await mettreAJourBloc(audit_id, 'bloc4', 'en_attente_validation', resultat4a.resultats, resultat4a.couts)
      await logInfo(audit_id, 'Bloc 4 Phase A terminé — en attente validation keywords', 'bloc4', {
        duree_ms: Date.now() - debut4,
        cout: resultat4a.couts.total,
        domaine_ot: paramsAvecDomaine.domaine_ot,
        nb_keywords: ((resultat4a.resultats as Record<string, unknown>).phase_a as Record<string, unknown> | undefined)
          ?.keywords_classes
          ? ((resultat4a.resultats as Record<string, unknown>).phase_a as { keywords_classes: unknown[] }).keywords_classes.length
          : 0,
      })
    } catch (err) {
      await mettreAJourBloc(audit_id, 'bloc4', 'erreur')
      await logError(audit_id, 'Bloc 4 Phase A échoué', 'bloc4', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        params: { destination: paramsAvecDomaine.nom, domaine_ot: paramsAvecDomaine.domaine_ot },
      })
    }

    return NextResponse.json({
      success: true,
      statut: 'en_attente_validation',
      bloc: 'bloc4',
    })
  } catch (err) {
    console.error('[segment-a] Erreur fatale :', err)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
