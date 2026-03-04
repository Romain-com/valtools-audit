// Route Handler — Mots-clés positionnés du domaine de référence
// DataForSEO Labs ranked_keywords — retourne jusqu'à 1000 mots-clés organiques

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { RankedKeyword } from '@/types/visibility'

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN!
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD!

function getAuth(): string {
  return Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
}

export async function POST(req: NextRequest) {
  try {
    const { domain }: { domain: string } = await req.json()

    if (!domain?.trim()) {
      return NextResponse.json({ error: 'domain est requis' }, { status: 400 })
    }

    const response = await axios.post(
      'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live',
      [
        {
          target: domain.replace('www.', ''),
          language_code: 'fr',
          location_code: 2250,
          limit: 1000,
          item_types: ['organic'],
        },
      ],
      {
        headers: {
          Authorization: `Basic ${getAuth()}`,
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      }
    )

    const items: unknown[] = response.data?.tasks?.[0]?.result?.[0]?.items ?? []

    // CTR moyen par position (source : Sistrix / AWR industry benchmarks)
    const CTR: Record<number, number> = {
      1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.07,
      6: 0.05, 7: 0.04, 8: 0.03, 9: 0.03, 10: 0.02,
    }
    function ctrParPosition(pos: number): number {
      if (pos <= 0) return 0
      if (pos <= 10) return CTR[pos] ?? 0.02
      if (pos <= 20) return 0.01
      return 0.005
    }

    // ⚠️ Le volume est sous keyword_data.keyword_info.search_volume (pas keyword_data.search_volume)
    // ⚠️ DataForSEO ne retourne pas etv pour cet endpoint — calculé via CTR × volume
    const rankedKeywords: RankedKeyword[] = items.map((item: unknown) => {
      const it = item as {
        keyword_data?: {
          keyword?: string
          keyword_info?: { search_volume?: number }
        }
        ranked_serp_element?: { serp_item?: { rank_absolute?: number; url?: string } }
      }
      const position = it.ranked_serp_element?.serp_item?.rank_absolute ?? 0
      const searchVolume = it.keyword_data?.keyword_info?.search_volume ?? 0
      return {
        keyword: it.keyword_data?.keyword ?? '',
        position,
        searchVolume,
        etv: Math.round(searchVolume * ctrParPosition(position)),
        url: it.ranked_serp_element?.serp_item?.url ?? '',
      }
    })

    return NextResponse.json({ rankedKeywords })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[visibility/ranked]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
