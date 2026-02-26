// Route Handler — Google PageSpeed Insights
// Wrapper mince — la logique métier est dans ./logic.ts
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import { executerPageSpeed } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerPageSpeed(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
