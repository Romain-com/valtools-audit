// Route Handler — /api/blocs/volume-affaires/epci
// Proxy vers le microservice local pour résoudre l'EPCI d'une commune

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const MICROSERVICE_URL = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'

export async function POST(req: NextRequest) {
  try {
    const { code_insee } = await req.json()

    if (!code_insee) {
      return NextResponse.json({ error: 'code_insee requis' }, { status: 400 })
    }

    const reponse = await axios.get(`${MICROSERVICE_URL}/epci`, {
      params: { code_insee },
      timeout: 5000,
    })

    return NextResponse.json(reponse.data)
  } catch (err: unknown) {
    // 404 du microservice = commune sans EPCI — cas normal, pas une erreur
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return NextResponse.json({ siren_epci: null })
    }

    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
