// Route Handler — Sauvegarde d'une analyse de lieu touristique en base Supabase
// Insère dans place_analyses avec les données complètes + diagnostic

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PlaceData } from '@/types/place'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const placeData: PlaceData = await req.json()

    if (!placeData.placeName?.trim() || !placeData.commune?.trim()) {
      return NextResponse.json({ error: 'placeName et commune sont requis' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('place_analyses')
      .insert({
        place_name: placeData.placeName,
        commune: placeData.commune,
        place_domain: placeData.placeHaloscan?.domain ?? null,
        commune_domain: placeData.communeHaloscan?.domain ?? null,
        place_exists: placeData.diagnostic?.placeExists ?? false,
        commune_mentions_place: placeData.diagnostic?.communeMentionsPlace ?? false,
        place_visibility: placeData.diagnostic?.placeVisibilityVsCommune ?? null,
        score_total: null, // pas de score calculé sur Vue 2
        resultats: placeData,
        headline: placeData.diagnostic?.headline ?? null,
        recommendations: placeData.diagnostic?.recommendations ?? [],
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
