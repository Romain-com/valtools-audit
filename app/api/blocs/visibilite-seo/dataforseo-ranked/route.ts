// Route Handler — DataForSEO ranked_keywords/live
// Responsabilité : récupérer les keywords sur lesquels le domaine OT est positionné
// ⚠️  Serveur uniquement — aucune clé API exposée côté client
// ⚠️  Chemin de parsing : data?.tasks?.[0]?.result?.[0]?.items ?? []

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { KeywordPositionneOT } from '@/types/visibilite-seo'

const DATAFORSEO_URL = 'https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live'
const TIMEOUT_MS = 60_000

// ─── Types internes DataForSEO ───────────────────────────────────────────────

interface RankedKeywordItem {
  keyword_data?: {
    keyword?: string
    keyword_info?: {
      search_volume?: number
      cpc?: number
    }
  }
  ranked_serp_element?: {
    serp_item?: {
      rank_group?: number
      rank_absolute?: number
      url?: string
    }
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { domaine_ot } = body as { domaine_ot?: string }

  if (!domaine_ot) {
    return NextResponse.json({ erreur: 'Paramètre domaine_ot manquant' }, { status: 400 })
  }

  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD

  if (!login || !password) {
    return NextResponse.json(
      { erreur: 'Variables DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD manquantes' },
      { status: 500 }
    )
  }

  try {
    const response = await axios.post(
      DATAFORSEO_URL,
      [
        {
          target: domaine_ot,
          location_code: 2250,
          language_code: 'fr',
          limit: 200,
          item_types: ['organic'],
          order_by: ['keyword_data.keyword_info.search_volume,desc'],
        },
      ],
      {
        auth: { username: login, password },
        timeout: TIMEOUT_MS,
      }
    )

    // ⚠️ Chemin de parsing complet — ne pas sauter le niveau items
    const items: RankedKeywordItem[] = response.data?.tasks?.[0]?.result?.[0]?.items ?? []

    const keywords_positionnes_ot: KeywordPositionneOT[] = items
      .filter(
        (item) =>
          item.keyword_data?.keyword &&
          item.ranked_serp_element?.serp_item?.rank_group !== undefined
      )
      .map((item) => ({
        keyword: item.keyword_data!.keyword!,
        volume: item.keyword_data?.keyword_info?.search_volume ?? 0,
        position: item.ranked_serp_element!.serp_item!.rank_group!,
        url_positionnee: item.ranked_serp_element?.serp_item?.url ?? '',
        cpc: item.keyword_data?.keyword_info?.cpc ?? undefined,
      }))

    // Trafic estimé capté par l'OT (approximation CTR moyen par position)
    const trafic_capte_estime = estimerTraficCapte(keywords_positionnes_ot)

    return NextResponse.json({
      keywords_positionnes_ot,
      trafic_capte_estime,
      cout: {
        nb_appels: 1,
        cout_unitaire: API_COSTS.dataforseo_ranked,
        cout_total: API_COSTS.dataforseo_ranked,
      },
    })
  } catch (err) {
    console.error('[dataforseo-ranked] Erreur :', (err as Error).message)
    return NextResponse.json({
      keywords_positionnes_ot: [],
      trafic_capte_estime: 0,
      erreur: (err as Error).message,
      cout: { nb_appels: 1, cout_unitaire: API_COSTS.dataforseo_ranked, cout_total: API_COSTS.dataforseo_ranked },
    })
  }
}

// ─── Helper : estimation trafic capté ────────────────────────────────────────

/**
 * Estimation du trafic mensuel capté par l'OT.
 * CTR approximatifs par position (source : études CTR Google 2023).
 */
function estimerTraficCapte(keywords: KeywordPositionneOT[]): number {
  const ctr: Record<number, number> = {
    1: 0.28,
    2: 0.15,
    3: 0.10,
    4: 0.07,
    5: 0.05,
    6: 0.04,
    7: 0.03,
    8: 0.025,
    9: 0.02,
    10: 0.015,
  }

  return Math.round(
    keywords.reduce((total, kw) => {
      const taux = ctr[kw.position] ?? (kw.position <= 20 ? 0.01 : 0.005)
      return total + kw.volume * taux
    }, 0)
  )
}
