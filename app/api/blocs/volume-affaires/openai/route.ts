// Route Handler — /api/blocs/volume-affaires/openai
// Génère via GPT-4o-mini : synthèse volume d'affaires + 3 indicateurs clés
// Si EPCI : estime aussi la part de la commune dans le total intercommunal

import { NextRequest, NextResponse } from 'next/server'
import { executerOpenAIVolumeAffaires } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerOpenAIVolumeAffaires(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
