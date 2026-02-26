// Route Handler — OpenAI synthèse gap SEO (Phase B)
// Délègue toute la logique métier à logic.ts pour permettre l'import direct par l'orchestrateur.

import { NextRequest, NextResponse } from 'next/server'
import { executerSyntheseVisibiliteSEO } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerSyntheseVisibiliteSEO(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
