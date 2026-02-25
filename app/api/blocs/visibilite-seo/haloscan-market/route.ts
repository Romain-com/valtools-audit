// Route Handler — Haloscan keywords/overview (marché)
// Responsabilité : 8 seeds en parallèle → keywords marché + PAA + métriques seo/ads
// ⚠️  Serveur uniquement — aucune clé API exposée côté client
// ⚠️  serp.results est un OBJET (pas un array) — accéder via .serp[] à l'intérieur

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { KeywordMarche } from '@/types/visibilite-seo'

const HALOSCAN_URL = 'https://api.haloscan.com/api/keywords/overview'
const TIMEOUT_MS = 30_000

// ─── Types internes Haloscan ──────────────────────────────────────────────────

interface HaloscanKeywordResult {
  keyword: string
  volume?: number
}

interface HaloscanReponse {
  keyword?: string
  errors?: unknown[]
  keyword_match?: { results?: HaloscanKeywordResult[] }
  similar_highlight?: { results?: HaloscanKeywordResult[] }
  related_question?: { results?: HaloscanKeywordResult[] }
  seo_metrics?: { volume?: number; keyword_count?: number; kgr?: number; results_count?: number }
  ads_metrics?: { volume?: number; cpc?: number; competition?: number; impressions?: number }
  top_sites?: { results?: Array<{ domain: string; score: number }> }
  serp?: { results?: { serp_date?: string; serp?: Array<{ position: number; url: string; title: string; description: string }> } }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrait les keywords d'un tableau de résultats Haloscan.
 * Filtre les entrées sans volume ou sans keyword.
 */
function extraireKeywords(
  items: HaloscanKeywordResult[] | undefined,
  source: KeywordMarche['source'],
  seed: string,
  cpc?: number,
  competition?: number
): KeywordMarche[] {
  if (!items?.length) return []
  return items
    .filter((item) => item.keyword && typeof item.volume === 'number' && item.volume > 0)
    .map((item) => ({
      keyword: item.keyword,
      volume: item.volume ?? 0,
      source,
      seed,
      cpc,
      competition,
    }))
}

/**
 * Appelle Haloscan keywords/overview pour un seed donné.
 * Retourne les keywords marché + PAA. En cas d'erreur, retourne des tableaux vides.
 */
async function appelSeed(
  keyword: string,
  seed: string,
  apiKey: string
): Promise<{ keywords: KeywordMarche[]; paa: KeywordMarche[]; volume_seed: number }> {
  try {
    const response = await axios.post<HaloscanReponse>(
      HALOSCAN_URL,
      {
        keyword,
        requested_data: [
          'keyword_match',
          'similar_highlight',
          'related_question',
          'top_sites',
          'seo_metrics',
          'ads_metrics',
        ],
      },
      {
        headers: { 'haloscan-api-key': apiKey, 'Content-Type': 'application/json' },
        timeout: TIMEOUT_MS,
      }
    )

    const data = response.data

    // Volume et CPC du keyword seed principal
    const cpc = data.ads_metrics?.cpc ?? undefined
    const competition = data.ads_metrics?.competition ?? undefined
    const volume_seed = data.seo_metrics?.volume ?? data.ads_metrics?.volume ?? 0

    // Keywords : keyword_match + similar_highlight
    const kw_match = extraireKeywords(data.keyword_match?.results, 'keyword_match', seed, cpc, competition)
    const kw_similar = extraireKeywords(data.similar_highlight?.results, 'similar_highlight', seed, cpc, competition)

    // PAA : related_question
    const paa = extraireKeywords(data.related_question?.results, 'related_question', seed)

    return {
      keywords: [...kw_match, ...kw_similar],
      paa,
      volume_seed,
    }
  } catch (err) {
    console.error(`[haloscan-market] Erreur seed "${keyword}" :`, (err as Error).message)
    return { keywords: [], paa: [], volume_seed: 0 }
  }
}

/**
 * Déduplique une liste de keywords par valeur exacte.
 * En cas de doublon, conserve l'entrée au plus grand volume.
 */
function dedupliquerKeywords(liste: KeywordMarche[]): KeywordMarche[] {
  const parKeyword = new Map<string, KeywordMarche>()
  for (const kw of liste) {
    const existant = parKeyword.get(kw.keyword)
    if (!existant || kw.volume > existant.volume) {
      parKeyword.set(kw.keyword, kw)
    }
  }
  return Array.from(parKeyword.values())
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { destination } = body as { destination?: string }

  if (!destination) {
    return NextResponse.json({ erreur: 'Paramètre destination manquant' }, { status: 400 })
  }

  const apiKey = process.env.HALOSCAN_API_KEY
  if (!apiKey) {
    return NextResponse.json({ erreur: 'Variable HALOSCAN_API_KEY manquante' }, { status: 500 })
  }

  // ─── 8 seeds en parallèle — couvrent toutes les intentions touristiques ───
  const seeds = [
    { keyword: destination,                    seed: 'destination' },
    { keyword: `tourisme ${destination}`,       seed: 'tourisme' },
    { keyword: `que faire ${destination}`,      seed: 'que_faire' },
    { keyword: `activités ${destination}`,      seed: 'activites' },
    { keyword: `hébergement ${destination}`,    seed: 'hebergement' },
    { keyword: `visiter ${destination}`,        seed: 'visiter' },
    { keyword: `vacances ${destination}`,       seed: 'vacances' },
    { keyword: `week-end ${destination}`,       seed: 'week_end' },
  ]

  const resultats = await Promise.all(
    seeds.map(({ keyword, seed }) => appelSeed(keyword, seed, apiKey))
  )

  // ─── Fusion et déduplication ───────────────────────────────────────────────
  const tous_keywords = dedupliquerKeywords(resultats.flatMap((r) => r.keywords))
  const tous_paa = dedupliquerKeywords(resultats.flatMap((r) => r.paa))

  // Volume marché seeds = somme des volumes uniques (hors doublons) issus des 8 seeds
  const volume_marche_seeds = tous_keywords.reduce((acc, kw) => acc + kw.volume, 0)

  return NextResponse.json({
    keywords_marche: tous_keywords,
    paa_detectes: tous_paa,
    volume_marche_seeds,
    cout: {
      nb_appels: 8,
      cout_unitaire: API_COSTS.haloscan_keywords,
      cout_total: 8 * API_COSTS.haloscan_keywords,
    },
  })
}
