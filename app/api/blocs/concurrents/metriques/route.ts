// Route Handler — /api/blocs/concurrents/metriques
// Collecte les métriques SEO + Google Maps pour UN concurrent
// ⚠️ Appeler séquentiellement entre chaque concurrent pour respecter les rate limits

import { NextRequest, NextResponse } from 'next/server'
import { executerMetriquesConcurrents } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerMetriquesConcurrents(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
