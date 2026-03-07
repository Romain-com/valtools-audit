// Route Handler — Univers sémantique de la destination (deux niveaux)
// matchKeywords  : keywords/match  → mots-clés MARQUE (contiennent le seed)
// relatedKeywords: keywords/related → mots-clés GLOBAL (liés thématiquement, vol >= 100)
// Les deux sont paginés et retournés en parallèle

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { RelatedKeyword } from '@/types/visibility'

const HALOSCAN_API_KEY = process.env.HALOSCAN_API_KEY!
const MATCH_PAGE_SIZE = 200
const MATCH_MAX_PAGES = 15    // max 3 000 mots-clés marque
const RELATED_PAGE_SIZE = 200
const RELATED_MAX_PAGES = 10  // max 2 000 mots-clés globaux (vol >= 100)

function competitionLabel(val: unknown): string | null {
  const n = Number(val)
  if (isNaN(n)) return null
  if (n < 0.33) return 'LOW'
  if (n < 0.66) return 'MEDIUM'
  return 'HIGH'
}

function toRelatedKeyword(item: Record<string, unknown>): RelatedKeyword {
  return {
    keyword: String(item.keyword ?? ''),
    searchVolume: (item.volume && item.volume !== 'NA') ? Number(item.volume) : 0,
    cpc: item.cpc != null && item.cpc !== 'NA' ? Number(item.cpc) : null,
    competition: competitionLabel(item.competition !== 'NA' ? item.competition : null),
  }
}

async function fetchAllMatch(keyword: string): Promise<RelatedKeyword[]> {
  const all: unknown[] = []
  for (let page = 1; page <= MATCH_MAX_PAGES; page++) {
    const r = await axios.post(
      'https://api.haloscan.com/api/keywords/match',
      { keyword, lineCount: MATCH_PAGE_SIZE, page, order_by: 'volume', order: 'desc', volume_min: 10, exact_match: false },
      { headers: { 'haloscan-api-key': HALOSCAN_API_KEY, 'Content-Type': 'application/json' }, timeout: 30_000 }
    )
    const results: unknown[] = r.data?.results ?? []
    all.push(...results)
    if (results.length < MATCH_PAGE_SIZE || r.data?.remaining_result_count === 0) break
  }
  return all
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(toRelatedKeyword)
    .filter((rk) => rk.keyword !== '')
}

async function fetchAllRelated(keyword: string): Promise<RelatedKeyword[]> {
  const all: unknown[] = []
  for (let page = 1; page <= RELATED_MAX_PAGES; page++) {
    const r = await axios.post(
      'https://api.haloscan.com/api/keywords/related',
      { keyword, lineCount: RELATED_PAGE_SIZE, page, order_by: 'volume', order: 'desc', volume_min: 100 },
      { headers: { 'haloscan-api-key': HALOSCAN_API_KEY, 'Content-Type': 'application/json' }, timeout: 30_000 }
    )
    const results: unknown[] = r.data?.results ?? []
    all.push(...results)
    if (results.length < RELATED_PAGE_SIZE || r.data?.remaining_result_count === 0) break
  }
  return all
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(toRelatedKeyword)
    .filter((rk) => rk.keyword !== '')
}

export async function POST(req: NextRequest) {
  try {
    const { keyword }: { keyword: string } = await req.json()

    if (!keyword?.trim()) {
      return NextResponse.json({ error: 'keyword est requis' }, { status: 400 })
    }

    // Appels parallèles — les deux fetchs tournent en même temps
    const [matchKeywords, relatedKeywords] = await Promise.all([
      fetchAllMatch(keyword),
      fetchAllRelated(keyword),
    ])

    return NextResponse.json({ matchKeywords, relatedKeywords })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[visibility/related]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
