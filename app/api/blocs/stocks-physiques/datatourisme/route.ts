// Route Handler — /api/blocs/stocks-physiques/datatourisme
// Proxy vers le microservice local GET /stocks?code_insee=XXX
// Retourne le stock physique DATA Tourisme classé par catégorie + établissements bruts

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { RetourStocksDATATourisme } from '@/types/stocks-physiques'

const MICROSERVICE_URL = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'

export async function POST(req: NextRequest) {
  try {
    const { code_insee } = await req.json()

    if (!code_insee) {
      return NextResponse.json({ error: 'code_insee requis' }, { status: 400 })
    }

    const reponse = await axios.get<RetourStocksDATATourisme>(
      `${MICROSERVICE_URL}/stocks`,
      {
        params: { code_insee },
        timeout: 60000, // scan de tous les fichiers — peut prendre du temps sur les grandes communes
      }
    )

    return NextResponse.json(reponse.data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
