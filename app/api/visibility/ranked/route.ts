// Route Handler — Mots-clés positionnés du domaine de référence
// Haloscan domains/positions — pagine pour récupérer TOUS les mots-clés du domaine

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { RankedKeyword } from '@/types/visibility'

const HALOSCAN_API_KEY = process.env.HALOSCAN_API_KEY!
const PAGE_SIZE = 500
const MAX_PAGES = 60 // max 30 000 mots-clés

async function fetchPage(input: string, page: number): Promise<{ results: unknown[]; totalKeywords: number }> {
  const response = await axios.post(
    'https://api.haloscan.com/api/domains/positions',
    {
      input,
      mode: 'root',
      lineCount: PAGE_SIZE,
      page,
      order_by: 'traffic',
      order: 'desc',
    },
    {
      headers: {
        'haloscan-api-key': HALOSCAN_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    }
  )

  // Fallback si domaine non indexé
  if (response.data?.failure_reason || response.data?.response_code === 'SITE_NOT_FOUND') {
    return { results: [], totalKeywords: 0 }
  }

  return {
    results: response.data?.results ?? [],
    totalKeywords: response.data?.total_keyword_count ?? 0,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { domain }: { domain: string } = await req.json()

    if (!domain?.trim()) {
      return NextResponse.json({ error: 'domain est requis' }, { status: 400 })
    }

    const input = domain.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
    const allItems: unknown[] = []
    let page = 1

    while (page <= MAX_PAGES) {
      const { results, totalKeywords } = await fetchPage(input, page)
      allItems.push(...results)
      // Arrêt si on a tout récupéré ou si la page est incomplète
      if (results.length < PAGE_SIZE || allItems.length >= totalKeywords) break
      page++
    }

    // ⚠️ Haloscan retourne traffic (ETV direct) et volume séparément
    // traffic = trafic estimé mensuel, volume = volume de recherche du mot-clé
    const rankedKeywords: RankedKeyword[] = allItems
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        keyword: String(item.keyword ?? ''),
        position: (item.position && item.position !== 'NA') ? Number(item.position) : 0,
        searchVolume: (item.volume && item.volume !== 'NA') ? Number(item.volume) : 0,
        etv: (item.traffic && item.traffic !== 'NA') ? Math.round(Number(item.traffic)) : 0,
        url: String(item.url ?? ''),
      }))
      .filter((rk) => rk.keyword !== '')

    return NextResponse.json({ rankedKeywords })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[visibility/ranked]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
