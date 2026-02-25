// Segment C — Bloc 7 Phase B → statut global 'termine'
// Déclenché après validation des concurrents (Bloc 7 Phase B)
//
// ⚠️ runtime 'nodejs' obligatoire
// ⚠️ maxDuration = 120 — Phase B est plus courte

export const runtime = 'nodejs'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { lancerBloc7PhaseB } from '@/lib/orchestrateur/wrappers/bloc7'
import { logInfo, logError } from '@/lib/orchestrateur/logger'
import {
  mettreAJourBloc,
  mettreAJourStatutAudit,
  lireParamsAudit,
  lireBlocsStatuts,
} from '@/lib/orchestrateur/supabase-updates'
import { createClient } from '@supabase/supabase-js'
import type { ConcurrentIdentifie } from '@/types/concurrents'

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Variables Supabase manquantes')
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  try {
    const { audit_id, concurrents_valides } = await req.json() as {
      audit_id: string
      concurrents_valides: ConcurrentIdentifie[]
    }

    if (!audit_id) {
      return NextResponse.json({ error: 'audit_id requis' }, { status: 400 })
    }

    if (!Array.isArray(concurrents_valides) || concurrents_valides.length === 0) {
      return NextResponse.json({ error: 'concurrents_valides requis (tableau non vide)' }, { status: 400 })
    }

    // ── Vérification : Bloc 7 doit être en_attente_validation ─────────────────
    const blocsStatuts = await lireBlocsStatuts(audit_id)

    if (blocsStatuts.bloc7 !== 'en_attente_validation') {
      return NextResponse.json(
        { error: `Bloc 7 n'est pas en attente de validation (statut actuel : ${blocsStatuts.bloc7})` },
        { status: 409 }
      )
    }

    // ── Lecture des paramètres ─────────────────────────────────────────────────
    const params = await lireParamsAudit(audit_id)

    await logInfo(audit_id, 'Segment C démarré', undefined, {
      destination: params.nom,
      nb_concurrents_valides: concurrents_valides.length,
    })

    // ─────────────────────────────────────────────────────────────────────────────
    // BLOC 7 Phase B — Synthèse comparative concurrents
    // ─────────────────────────────────────────────────────────────────────────────
    await logInfo(audit_id, 'Bloc 7 Phase B démarré', 'bloc7')
    await mettreAJourBloc(audit_id, 'bloc7', 'en_cours')

    const debutAudit = Date.now()
    const debut7b = Date.now()

    try {
      const resultat7b = await lancerBloc7PhaseB({ ...params, concurrents_valides })
      await mettreAJourBloc(audit_id, 'bloc7', 'termine', resultat7b.resultats, resultat7b.couts)
      await logInfo(audit_id, 'Bloc 7 Phase B terminé', 'bloc7', {
        duree_ms: Date.now() - debut7b,
        cout: resultat7b.couts.total,
      })
    } catch (err) {
      await mettreAJourBloc(audit_id, 'bloc7', 'erreur')
      await logError(audit_id, 'Bloc 7 Phase B échoué', 'bloc7', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        params: { destination: params.nom, nb_concurrents: concurrents_valides.length },
      })
    }

    // ── Calcul du coût total de l'audit ───────────────────────────────────────
    const supabase = getSupabase()
    const { data: auditFinal } = await supabase
      .from('audits')
      .select('couts_api')
      .eq('id', audit_id)
      .single()

    const coutsApi = auditFinal?.couts_api as Record<string, unknown> | null
    const coutTotal = typeof coutsApi?.total_audit === 'number' ? coutsApi.total_audit : 0

    // ── Statut global → termine ────────────────────────────────────────────────
    await mettreAJourStatutAudit(audit_id, 'termine')

    await logInfo(audit_id, 'Audit terminé', undefined, {
      destination: params.nom,
      cout_total: coutTotal,
      duree_totale_ms: Date.now() - debutAudit,
    })

    return NextResponse.json({
      success: true,
      statut: 'termine',
    })
  } catch (err) {
    console.error('[segment-c] Erreur fatale :', err)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
