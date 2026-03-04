// Route Handler — Sauvegarde d'une analyse de territoire en base Supabase
// POST : insertion ou mise à jour (si id fourni) dans territoire_analyses

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await req.json()
    const { id, nom, communes, resultats, analyse_gpt } = body

    if (!communes || !resultats) {
      return NextResponse.json({ error: 'Données manquantes (communes, resultats)' }, { status: 400 })
    }

    // Si un id est fourni → mise à jour (ex: ajout de la synthèse GPT après coup)
    if (id) {
      const updatePayload: Record<string, unknown> = {}
      if (resultats !== undefined) updatePayload.resultats = resultats
      if (analyse_gpt !== undefined) updatePayload.analyse_gpt = analyse_gpt
      if (communes !== undefined) updatePayload.communes = communes
      if (nom !== undefined) updatePayload.nom = nom

      const { data, error } = await supabase
        .from('territoire_analyses')
        .update(updatePayload)
        .eq('id', id)
        .select('id, created_at')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ id: data.id, created_at: data.created_at })
    }

    // Sinon → nouvelle insertion
    const nomAnalyse = nom || `Analyse ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`

    const { data, error } = await supabase
      .from('territoire_analyses')
      .insert({
        nom: nomAnalyse,
        communes,
        resultats,
        analyse_gpt: analyse_gpt ?? null,
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
