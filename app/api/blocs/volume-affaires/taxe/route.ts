// Route Handler — /api/blocs/volume-affaires/taxe
// Interroge data.economie.gouv.fr pour récupérer le montant de taxe de séjour
// Comptes 731721 (taxe de séjour) + 731722 (taxe de séjour forfaitaire)

import { NextRequest, NextResponse } from 'next/server'
import { executerTaxe } from './logic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultat = await executerTaxe(body)
    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
