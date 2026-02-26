// Route Handler — /api/blocs/volume-affaires/epci
// Proxy vers le microservice local pour résoudre l'EPCI d'une commune

import { NextRequest, NextResponse } from 'next/server'
import { executerEPCI } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerEPCI(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
