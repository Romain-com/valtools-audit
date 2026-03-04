// Route Handler — Sauvegarde d'une analyse de visibilité en base Supabase
// Insère dans visibility_analyses avec les scores + données complètes

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VisibilityData } from '@/types/visibility'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const analysisData: VisibilityData = await req.json()

    if (!analysisData.params?.keyword || !analysisData.params?.domain) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('visibility_analyses')
      .insert({
        type: analysisData.params.type,
        keyword: analysisData.params.keyword,
        domain: analysisData.params.domain,
        commune: analysisData.params.commune ?? null,
        scores: analysisData.scores,
        resultats: analysisData,
        headline: analysisData.headline ?? null,
        insights: analysisData.insights ?? [],
        created_by: user.id,
      })
      .select('id, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data.id, created_at: data.created_at })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
