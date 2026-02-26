// Route Handler — /api/blocs/volume-affaires/epci-communes
// Proxy vers le microservice local pour récupérer toutes les communes d'un EPCI
// Utilisé par l'enrichissement Mélodi (Bloc 2) pour identifier les communes à analyser

import { NextRequest, NextResponse } from 'next/server'
import { executerEPCICommunes } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerEPCICommunes(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
