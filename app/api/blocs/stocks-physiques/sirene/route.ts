// Route Handler — /api/blocs/stocks-physiques/sirene
// Interroge l'API "Recherche Entreprises" (recherche-entreprises.api.gouv.fr)
// Source libre, sans authentification, rate limit 25 req/s

import { NextRequest, NextResponse } from 'next/server'
import { executerSIRENE } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerSIRENE(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
