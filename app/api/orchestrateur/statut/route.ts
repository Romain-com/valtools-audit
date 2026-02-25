// Statut — GET fallback polling si Supabase Realtime déconnecté
// Retourne blocs_statuts + logs récents + statut global de l'audit

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Variables Supabase manquantes')
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const audit_id = searchParams.get('audit_id')

    if (!audit_id) {
      return NextResponse.json({ error: 'audit_id requis' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Lecture de l'audit
    const { data: audit, error } = await supabase
      .from('audits')
      .select('id, statut, resultats, couts_api')
      .eq('id', audit_id)
      .single()

    if (error || !audit) {
      return NextResponse.json({ error: 'Audit introuvable' }, { status: 404 })
    }

    const resultats = (audit.resultats as Record<string, unknown>) ?? {}
    const blocsStatuts = (resultats.blocs_statuts ?? {}) as Record<string, string>

    // Récupérer les 20 derniers logs
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('id, bloc, niveau, message, detail, created_at')
      .eq('audit_id', audit_id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      audit_id,
      statut: audit.statut,
      blocs_statuts: blocsStatuts,
      couts_api: audit.couts_api,
      logs: (logs ?? []).reverse(),  // Ordre chronologique pour l'affichage
    })
  } catch (err) {
    console.error('[statut] Erreur :', err)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
