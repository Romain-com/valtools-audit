// Route Handler — Mots-clés connexes DataForSEO Labs
// Retourne les mots-clés avec volume >= 100 dans l'univers sémantique du keyword

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { RelatedKeyword } from '@/types/visibility'

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN!
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD!

function getAuth(): string {
  return Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
}

export async function POST(req: NextRequest) {
  try {
    const { keyword }: { keyword: string } = await req.json()

    if (!keyword?.trim()) {
      return NextResponse.json({ error: 'keyword est requis' }, { status: 400 })
    }

    const response = await axios.post(
      'https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live',
      [
        {
          keyword,
          language_code: 'fr',
          location_code: 2250,
          depth: 2,
          limit: 200,
          include_seed_keyword: true,
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

    // ⚠️ Le volume est sous keyword_data.keyword_info.search_volume (pas keyword_data.search_volume)
    const relatedKeywords: RelatedKeyword[] = items
      .map((item: unknown) => {
        const it = item as {
          keyword_data?: {
            keyword?: string
            keyword_info?: { search_volume?: number; cpc?: number; competition_level?: string }
          }
        }
        return {
          keyword: it.keyword_data?.keyword ?? '',
          searchVolume: it.keyword_data?.keyword_info?.search_volume ?? 0,
          cpc: it.keyword_data?.keyword_info?.cpc ?? null,
          competition: it.keyword_data?.keyword_info?.competition_level ?? null,
        }
      })
      .filter((rk) => rk.keyword && rk.searchVolume >= 10)

    return NextResponse.json({ relatedKeywords })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[visibility/related]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
