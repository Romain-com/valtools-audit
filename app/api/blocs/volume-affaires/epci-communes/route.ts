// Route Handler — /api/blocs/volume-affaires/epci-communes
// Proxy vers le microservice local pour récupérer toutes les communes d'un EPCI
// Utilisé par l'enrichissement Mélodi (Bloc 2) pour identifier les communes à analyser

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const MICROSERVICE_URL = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'

export async function POST(req: NextRequest) {
  try {
    const { siren_epci } = await req.json()

    if (!siren_epci) {
      return NextResponse.json({ error: 'siren_epci requis' }, { status: 400 })
    }

    const reponse = await axios.get(`${MICROSERVICE_URL}/epci/communes`, {
      params: { siren_epci },
      timeout: 5000,
    })

    return NextResponse.json(reponse.data)
  } catch (err: unknown) {
    // 404 = EPCI sans communes dans le référentiel — cas rare mais gérable
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return NextResponse.json({ communes: [] })
    }

    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
