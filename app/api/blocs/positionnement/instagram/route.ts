// Route Handler — Apify Instagram
// Responsabilité : point d'entrée HTTP — délègue la logique à logic.ts
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import { executerInstagram } from './logic'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerInstagram(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
