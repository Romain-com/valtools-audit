// Logique métier — DataForSEO related_keywords (enrichissement corpus marché)
// Responsabilité : 4 seeds en parallèle → keywords liés + volumes
// ⚠️  Serveur uniquement — aucune clé API exposée côté client
// ⚠️  Complète Haloscan sans le remplacer (Haloscan reste la source des PAA et CPC)

import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'

const DATAFORSEO_URL = 'https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live'
const TIMEOUT_MS = 60_000

// ─── Types internes ────────────────────────────────────────────────────────────

interface KeywordRelated {
  keyword: string
  volume: number
  cpc: number | null
  source_seed: string
}

interface DataForSEORelatedItem {
  keyword_data?: {
    keyword?: string
    keyword_info?: {
      search_volume?: number
      cpc?: number | null
    }
  }
  depth?: number
}

// ─── Helper : appeler DataForSEO pour un seed ─────────────────────────────────

async function appelSeed(
  keyword: string,
  login: string,
  password: string
): Promise<KeywordRelated[]> {
  try {
    const response = await axios.post<{ tasks?: Array<{ result?: Array<{ items?: DataForSEORelatedItem[] }> }> }>(
      DATAFORSEO_URL,
      [{
        keyword,
        location_code: 2250,
        language_code: 'fr',
        limit: 100,
        depth: 2,
        include_seed_keyword: true,
      }],
      {
        auth: { username: login, password },
        timeout: TIMEOUT_MS,
      }
    )

    const items: DataForSEORelatedItem[] = response.data?.tasks?.[0]?.result?.[0]?.items ?? []

    return items
      .filter((item) => {
        const kw = item.keyword_data?.keyword
        const vol = item.keyword_data?.keyword_info?.search_volume
        return kw && typeof vol === 'number' && vol > 0
      })
      .map((item) => ({
        keyword: item.keyword_data!.keyword!,
        volume: item.keyword_data!.keyword_info!.search_volume!,
        cpc: item.keyword_data?.keyword_info?.cpc ?? null,
        source_seed: keyword,
      }))
  } catch (err) {
    console.error(`[dataforseo-related] Erreur seed "${keyword}" :`, (err as Error).message)
    return []
  }
}

// ─── Fonction exportée ────────────────────────────────────────────────────────

/**
 * Exécute l'appel DataForSEO related_keywords pour une destination.
 * Lance 4 seeds en parallèle et déduplique les résultats.
 */
export async function executerDataForSEORelated({ destination }: { destination: string }) {
  if (!destination) {
    throw new Error('Paramètre destination manquant')
  }

  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) {
    throw new Error('Variables DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD manquantes')
  }

  // ─── 4 seeds en parallèle ─────────────────────────────────────────────────
  const seeds = [
    destination,
    `tourisme ${destination}`,
    `activités ${destination}`,
    `visiter ${destination}`,
  ]

  const resultats = await Promise.all(
    seeds.map((seed) => appelSeed(seed, login, password))
  )

  const dest = destination.toLowerCase()

  // ─── Déduplication + filtre pertinence ────────────────────────────────────
  // Un keyword related sans mention de la destination est trop générique pour un OT.
  // Règle : conserver si contient la destination OU si ≥ 3 mots (assez spécifique).
  const parKeyword = new Map<string, KeywordRelated>()
  for (const liste of resultats) {
    for (const kw of liste) {
      const cle = kw.keyword.toLowerCase().trim()
      if (!cle.includes(dest) && cle.split(' ').length < 3) continue
      const existant = parKeyword.get(cle)
      if (!existant || kw.volume > existant.volume) {
        parKeyword.set(cle, kw)
      }
    }
  }

  const keywords = Array.from(parKeyword.values())
    .sort((a, b) => b.volume - a.volume)

  return {
    keywords,
    nb_keywords: keywords.length,
    cout: {
      nb_appels: seeds.length,
      cout_unitaire: API_COSTS.dataforseo_related,
      cout_total: seeds.length * API_COSTS.dataforseo_related,
    },
  }
}
