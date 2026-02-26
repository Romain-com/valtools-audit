// Route Handler — /api/blocs/concurrents/synthese
// Génère la synthèse comparative via GPT-4o-mini
// Input : tableau comparatif destination cible vs concurrents validés
// ⚠️ Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import { executerSyntheseConcurrents } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerSyntheseConcurrents(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
