// Route Handler — /api/blocs/concurrents/identification
// Identifie 5 destinations concurrentes via GPT-4o-mini à partir du contexte complet de l'audit
// ⚠️ Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import { executerIdentificationConcurrents } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerIdentificationConcurrents(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
