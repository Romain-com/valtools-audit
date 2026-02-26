// Route Handler — /api/blocs/stock-en-ligne/synthese
// Génère via GPT-4o-mini la synthèse de la commercialisation en ligne (Bloc 6)
// Input : données brutes des 4 sources + indicateurs calculés

import { NextRequest, NextResponse } from 'next/server'
import { executerSyntheseStockEnLigne } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerSyntheseStockEnLigne(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
