// Route Handler — /api/blocs/volume-affaires/melodi
// Collecte via API Mélodi (INSEE) les données logement de chaque commune d'un EPCI.
// Sources : RP 2022 (résidences secondaires) + BPE (hébergements touristiques D7).

import { NextRequest, NextResponse } from 'next/server'
import { executerMelodi } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerMelodi(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
