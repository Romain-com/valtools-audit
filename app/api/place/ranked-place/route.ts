// Route Handler — Métriques Haloscan pour le lieu et la commune
// Appel bulk unique si les deux domaines sont fournis
// ⚠️ Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { PlaceHaloscanData } from '@/types/place'

const HALOSCAN_API_KEY = process.env.HALOSCAN_API_KEY!

function makeEmpty(domain: string | null): PlaceHaloscanData {
  return { domain, totalTraffic: null, uniqueKeywords: null, totalTop10: null, found: false }
}

export async function POST(req: NextRequest) {
  try {
    const { placeDomain, communeDomain }: {
      placeDomain: string | null
      communeDomain: string | null
    } = await req.json()

    // Préparer la liste unique de domaines à interroger
    const domains: string[] = []
    if (placeDomain) domains.push(placeDomain)
    if (communeDomain && communeDomain !== placeDomain) domains.push(communeDomain)

    if (domains.length === 0) {
      return NextResponse.json({
        placeHaloscan: null,
        communeHaloscan: null,
      })
    }

    // Résultats initialisés à non-trouvé (fallback)
    const results: Record<string, PlaceHaloscanData> = {}
    for (const d of domains) {
      results[d] = makeEmpty(d)
    }

    try {
      const response = await axios.post(
        'https://api.haloscan.com/api/domains/bulk',
        {
          inputs: domains,
          mode: 'auto',
          order_by: 'total_traffic',
          order: 'desc',
          lineCount: 50,
        },
        {
          headers: {
            'haloscan-api-key': HALOSCAN_API_KEY,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        }
      )

      const items: Array<Record<string, unknown>> = response.data?.results ?? []

      for (const item of items) {
        const domain = (item.url as string) ?? ''
        if (!domain || !results[domain]) continue
        if ((item.errorCode as string) === 'SITE_NOT_FOUND') continue

        results[domain] = {
          domain,
          totalTraffic: (item.total_traffic as number) ?? null,
          uniqueKeywords: (item.unique_keywords as number) ?? null,
          totalTop10: (item.total_top_10 as number) ?? null,
          found: true,
        }
      }
    } catch {
      // Si Haloscan échoue, retourner les domaines avec found: false
    }

    return NextResponse.json({
      placeHaloscan: placeDomain ? results[placeDomain] ?? makeEmpty(placeDomain) : null,
      communeHaloscan: communeDomain ? results[communeDomain] ?? makeEmpty(communeDomain) : null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
