// Proxy server-side vers le microservice local — évite les problèmes CORS
// GET /api/communes?nom=XXX → GET http://localhost:3001/communes?nom=XXX
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const nom = req.nextUrl.searchParams.get('nom')
  if (!nom || nom.length < 2) {
    return NextResponse.json({ resultats: [] })
  }

  const baseUrl = process.env.DATA_TOURISME_API_URL || 'http://localhost:3001'

  try {
    const res = await fetch(`${baseUrl}/communes?nom=${encodeURIComponent(nom)}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      return NextResponse.json({ resultats: [] }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ resultats: [], erreur: 'microservice_indisponible' }, { status: 503 })
  }
}
