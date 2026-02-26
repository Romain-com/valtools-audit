// Route Handler — /api/blocs/stocks-physiques/datatourisme
// Proxy vers le microservice local GET /stocks?code_insee=XXX
// Retourne le stock physique DATA Tourisme classé par catégorie + établissements bruts

import { NextRequest, NextResponse } from 'next/server'
import { executerDataTourisme } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerDataTourisme(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
