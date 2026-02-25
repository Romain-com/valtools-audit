// Segment B — Bloc 4 Phase B → Bloc 5 → Bloc 6 → Bloc 7 Phase A
// Déclenché après validation des keywords (Bloc 4 Phase B)
// Se termine en statut 'en_attente_validation' sur le Bloc 7
//
// ⚠️ runtime 'nodejs' obligatoire — Bloc 6 utilise Playwright
// ⚠️ maxDuration = 300 — les blocs peuvent prendre jusqu'à 5 min au total

export const runtime = 'nodejs'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { lancerBloc4PhaseB } from '@/lib/orchestrateur/wrappers/bloc4'
import { lancerBloc5 } from '@/lib/orchestrateur/wrappers/bloc5'
import { lancerBloc6 } from '@/lib/orchestrateur/wrappers/bloc6'
import { lancerBloc7PhaseA } from '@/lib/orchestrateur/wrappers/bloc7'
import { logInfo, logError } from '@/lib/orchestrateur/logger'
import {
  mettreAJourBloc,
  lireParamsAudit,
  lireBlocsStatuts,
} from '@/lib/orchestrateur/supabase-updates'
import type { KeywordClassifie } from '@/types/visibilite-seo'

export async function POST(req: NextRequest) {
  try {
    const { audit_id, keywords_valides } = await req.json() as {
      audit_id: string
      keywords_valides: KeywordClassifie[]
    }

    if (!audit_id) {
      return NextResponse.json({ error: 'audit_id requis' }, { status: 400 })
    }

    if (!Array.isArray(keywords_valides) || keywords_valides.length === 0) {
      return NextResponse.json({ error: 'keywords_valides requis (tableau non vide)' }, { status: 400 })
    }

    // ── Vérification : Bloc 4 doit être en_attente_validation ─────────────────
    const blocsStatuts = await lireBlocsStatuts(audit_id)

    if (blocsStatuts.bloc4 !== 'en_attente_validation') {
      return NextResponse.json(
        { error: `Bloc 4 n'est pas en attente de validation (statut actuel : ${blocsStatuts.bloc4})` },
        { status: 409 }
      )
    }

    // ── Lecture des paramètres avec domaine_ot disponible ─────────────────────
    const params = await lireParamsAudit(audit_id)

    await logInfo(audit_id, 'Segment B démarré', undefined, {
      destination: params.nom,
      nb_keywords_valides: keywords_valides.length,
    })

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOC 4 Phase B — SERP live + synthèse gap
    // ─────────────────────────────────────────────────────────────────────────────
    await logInfo(audit_id, 'Bloc 4 Phase B démarré', 'bloc4')
    await mettreAJourBloc(audit_id, 'bloc4', 'en_cours')

    const debut4b = Date.now()
    try {
      const resultat4b = await lancerBloc4PhaseB({ ...params, keywords_valides })
      await mettreAJourBloc(audit_id, 'bloc4', 'termine', resultat4b.resultats, resultat4b.couts)
      await logInfo(audit_id, 'Bloc 4 Phase B terminé', 'bloc4', {
        duree_ms: Date.now() - debut4b,
        cout: resultat4b.couts.total,
      })
    } catch (err) {
      await mettreAJourBloc(audit_id, 'bloc4', 'erreur')
      await logError(audit_id, 'Bloc 4 Phase B échoué', 'bloc4', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        params: { destination: params.nom, nb_keywords: keywords_valides.length },
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOC 5 — Stocks physiques
    // ─────────────────────────────────────────────────────────────────────────────
    await logInfo(audit_id, 'Bloc 5 démarré', 'bloc5')
    await mettreAJourBloc(audit_id, 'bloc5', 'en_cours')

    const debut5 = Date.now()
    try {
      const resultat5 = await lancerBloc5(params)
      await mettreAJourBloc(audit_id, 'bloc5', 'termine', resultat5.resultats, resultat5.couts)
      await logInfo(audit_id, 'Bloc 5 terminé', 'bloc5', {
        duree_ms: Date.now() - debut5,
        cout: resultat5.couts.total,
      })
    } catch (err) {
      await mettreAJourBloc(audit_id, 'bloc5', 'erreur')
      await logError(audit_id, 'Bloc 5 échoué', 'bloc5', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        params: { destination: params.nom, code_insee: params.code_insee },
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOC 6 — Stock en ligne (Playwright)
    // ─────────────────────────────────────────────────────────────────────────────
    await logInfo(audit_id, 'Bloc 6 démarré', 'bloc6')
    await mettreAJourBloc(audit_id, 'bloc6', 'en_cours')

    const debut6 = Date.now()
    try {
      const resultat6 = await lancerBloc6(params)
      await mettreAJourBloc(audit_id, 'bloc6', 'termine', resultat6.resultats, resultat6.couts)
      await logInfo(audit_id, 'Bloc 6 terminé', 'bloc6', {
        duree_ms: Date.now() - debut6,
        cout: resultat6.couts.total,
      })
    } catch (err) {
      await mettreAJourBloc(audit_id, 'bloc6', 'erreur')
      await logError(audit_id, 'Bloc 6 échoué', 'bloc6', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        params: { destination: params.nom, domaine_ot: params.domaine_ot },
      })
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOC 7 Phase A — Identification des concurrents
    // ─────────────────────────────────────────────────────────────────────────────
    // Recharger les params — domaine_ot peut avoir été mis à jour
    const paramsRefresh = await lireParamsAudit(audit_id)

    await logInfo(audit_id, 'Bloc 7 Phase A démarré', 'bloc7')
    await mettreAJourBloc(audit_id, 'bloc7', 'en_cours')

    const debut7 = Date.now()
    try {
      const resultat7a = await lancerBloc7PhaseA(paramsRefresh)

      // Statut en_attente_validation après Phase A
      await mettreAJourBloc(audit_id, 'bloc7', 'en_attente_validation', resultat7a.resultats, resultat7a.couts)
      await logInfo(audit_id, 'Bloc 7 Phase A terminé — en attente validation concurrents', 'bloc7', {
        duree_ms: Date.now() - debut7,
        cout: resultat7a.couts.total,
        nb_concurrents: ((resultat7a.resultats as Record<string, unknown>).phase_a as Record<string, unknown> | undefined)
          ?.concurrents
          ? ((resultat7a.resultats as { phase_a: { concurrents: unknown[] } }).phase_a.concurrents.length)
          : 0,
      })
    } catch (err) {
      await mettreAJourBloc(audit_id, 'bloc7', 'erreur')
      await logError(audit_id, 'Bloc 7 Phase A échoué', 'bloc7', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        params: { destination: paramsRefresh.nom, domaine_ot: paramsRefresh.domaine_ot },
      })
    }

    return NextResponse.json({
      success: true,
      statut: 'en_attente_validation',
      bloc: 'bloc7',
    })
  } catch (err) {
    console.error('[segment-b] Erreur fatale :', err)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
