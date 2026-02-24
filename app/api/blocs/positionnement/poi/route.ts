// Route Handler — DATA Tourisme POI
// Responsabilité : récupérer les POI bruts d'une destination via le microservice DATA Tourisme
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { POIBrut } from '@/types/positionnement'

// Timeout court — le microservice DATA Tourisme est local/rapide
const TIMEOUT_MS = 10_000

interface ReponsePOI {
  poi: POIBrut[]
  erreur?: boolean
}

export async function POST(request: NextRequest) {
  // Lecture du body
  const body = await request.json().catch(() => ({}))
  const { code_insee } = body as { code_insee?: string }

  if (!code_insee) {
    return NextResponse.json({ erreur: 'Paramètre code_insee manquant' }, { status: 400 })
  }

  const apiUrl = process.env.DATA_TOURISME_API_URL

  if (!apiUrl) {
    return NextResponse.json({ erreur: 'Variable DATA_TOURISME_API_URL manquante' }, { status: 500 })
  }

  // ─── Appel au microservice DATA Tourisme ─────────────────────────────────
  try {
    const response = await axios.get<POIBrut[]>(
      `${apiUrl}/poi`,
      {
        params: {
          code_insee,
          limit: 10,
        },
        timeout: TIMEOUT_MS,
      }
    )

    const poi = Array.isArray(response.data) ? response.data : []

    const resultat: ReponsePOI = { poi }
    return NextResponse.json(resultat)
  } catch (err) {
    // Fallback : tableau vide — la suite du flux doit gérer ce cas (poi-selection le détecte)
    console.error('[POI] Erreur appel DATA Tourisme :', err)
    const resultat: ReponsePOI = { poi: [], erreur: true }
    return NextResponse.json(resultat)
  }
}
