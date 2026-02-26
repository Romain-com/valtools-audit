// Route Handler — /api/blocs/stocks-physiques/synthese
// Génère via GPT-4o-mini la synthèse narrative des stocks physiques
// Input : stocks finaux fusionnés (DATA Tourisme + SIRENE)

import { NextRequest, NextResponse } from 'next/server'
import { executerSyntheseStocksPhysiques } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerSyntheseStocksPhysiques(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
