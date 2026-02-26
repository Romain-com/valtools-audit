// Route Handler — OpenAI classification des keywords
// Délègue toute la logique métier à logic.ts pour permettre l'import direct par l'orchestrateur.

import { NextRequest, NextResponse } from 'next/server'
import { executerClassificationSEO } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerClassificationSEO(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
