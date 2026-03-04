// Route Handler — Sauvegarde d'une analyse d'écosystème en base Supabase
// Reçoit les sites enrichis + coûts API, insère dans ecosystem_analyses

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EnrichedSite } from '@/types/ecosystem'

interface SavePayload {
  destination: string
  sites: EnrichedSite[]
  couts_api: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérification de l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { destination, sites, couts_api }: SavePayload = await req.json()

    if (!destination?.trim() || !Array.isArray(sites)) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('ecosystem_analyses')
      .insert({
        destination: destination.trim(),
        sites,
        couts_api: couts_api ?? {},
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
