// Route Handler — DataForSEO SERP live (Phase B)
// Responsabilité : vérifier les positions réelles pour les keywords transactionnels avec gap
// ⚠️  Serveur uniquement — aucune clé API exposée côté client
// ⚠️  Toujours filtrer item.type === 'organic' — ne jamais utiliser d'index fixe

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { KeywordClassifie, ResultatSERPTransac } from '@/types/visibilite-seo'

const DATAFORSEO_URL = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced'
const TIMEOUT_MS = 60_000
const MAX_KEYWORDS = 8  // Limite budget Phase B

// ─── Types internes DataForSEO ───────────────────────────────────────────────

interface DataForSEOItem {
  type: string
  rank_absolute?: number
  rank_group?: number
  url?: string
  domain?: string
  title?: string
}

// ─── Helper : extraire position OT et concurrent pos 1 ───────────────────────

function analyserSERP(
  items: DataForSEOItem[],
  domaine_ot: string
): Pick<ResultatSERPTransac, 'position_ot' | 'url_ot' | 'concurrent_pos1' | 'concurrent_pos1_url'> {
  const organiques = items.filter((item) => item.type === 'organic')

  // Trouver la position du domaine OT (comparer en ignorant le www.)
  const domaineOTNu = domaine_ot.replace(/^www\./, '')
  let position_ot: number | null = null
  let url_ot: string | null = null

  for (const item of organiques) {
    const domaine = (item.domain ?? '').replace(/^www\./, '')
    if (domaine === domaineOTNu) {
      position_ot = item.rank_group ?? item.rank_absolute ?? null
      url_ot = item.url ?? null
      break
    }
  }

  // Site en position 1 (pas l'OT lui-même)
  const pos1 = organiques[0]
  const concurrent_pos1 = pos1?.domain ?? null
  const concurrent_pos1_url = pos1?.url ?? null

  return { position_ot, url_ot, concurrent_pos1, concurrent_pos1_url }
}

// ─── Sélection des keywords Phase B ──────────────────────────────────────────

/**
 * Sélectionne les keywords pour la Phase B SERP live.
 * Stratégie : 50% transac + gap fort volume | 50% absence totale OT
 * L'utilisateur peut modifier via selectionne_phase_b, sinon on applique la sélection auto.
 */
export function selectionnerKeywordsPhaseB(
  keywords_classes: KeywordClassifie[],
  max: number = MAX_KEYWORDS
): KeywordClassifie[] {
  // Vérifier si l'utilisateur a fait une sélection manuelle
  const selectionManuelle = keywords_classes.filter((kw) => kw.selectionne_phase_b === true)
  if (selectionManuelle.length > 0) {
    return selectionManuelle.slice(0, max)
  }

  // Sélection automatique
  const transac_gap = keywords_classes
    .filter((kw) => kw.gap && kw.intent_transactionnel)
    .sort((a, b) => b.volume - a.volume)

  const absences_totales = keywords_classes
    .filter((kw) => kw.gap && kw.position_ot === null && !kw.intent_transactionnel)
    .sort((a, b) => b.volume - a.volume)

  const moitie = Math.ceil(max / 2)
  const selection: KeywordClassifie[] = [
    ...transac_gap.slice(0, moitie),
    ...absences_totales.slice(0, max - Math.min(moitie, transac_gap.length)),
  ]

  // Compléter si pas assez
  if (selection.length < max) {
    const dejaDans = new Set(selection.map((kw) => kw.keyword))
    const reste = keywords_classes
      .filter((kw) => kw.gap && !dejaDans.has(kw.keyword))
      .sort((a, b) => b.volume - a.volume)
    selection.push(...reste.slice(0, max - selection.length))
  }

  return selection.slice(0, max)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { keywords_classes, domaine_ot } = body as {
    keywords_classes?: KeywordClassifie[]
    domaine_ot?: string
  }

  if (!keywords_classes?.length || !domaine_ot) {
    return NextResponse.json(
      { erreur: 'Paramètres keywords_classes et domaine_ot requis' },
      { status: 400 }
    )
  }

  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD

  if (!login || !password) {
    return NextResponse.json(
      { erreur: 'Variables DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD manquantes' },
      { status: 500 }
    )
  }

  const auth = { username: login, password }

  // ─── Sélection des keywords à analyser ────────────────────────────────────
  const keywords_selectionnes = selectionnerKeywordsPhaseB(keywords_classes)

  if (!keywords_selectionnes.length) {
    return NextResponse.json({
      serp_results: [],
      keywords_analyses: [],
      cout: { nb_appels: 0, cout_unitaire: API_COSTS.dataforseo_serp, cout_total: 0 },
    })
  }

  // ─── SERP live — 1 appel par keyword (séquentiel pour limiter la charge) ──
  const serp_results: ResultatSERPTransac[] = []
  let nb_appels = 0

  for (const kw of keywords_selectionnes) {
    try {
      const response = await axios.post(
        DATAFORSEO_URL,
        [{ keyword: kw.keyword, language_code: 'fr', location_code: 2250, depth: 20 }],
        { auth, timeout: TIMEOUT_MS }
      )

      nb_appels++
      const items: DataForSEOItem[] = response.data?.tasks?.[0]?.result?.[0]?.items ?? []
      const analyse = analyserSERP(items, domaine_ot)

      serp_results.push({
        keyword: kw.keyword,
        ...analyse,
      })
    } catch (err) {
      console.error(`[serp-transac] Erreur keyword "${kw.keyword}" :`, (err as Error).message)
      nb_appels++
      serp_results.push({
        keyword: kw.keyword,
        position_ot: null,
        url_ot: null,
        concurrent_pos1: null,
        concurrent_pos1_url: null,
      })
    }
  }

  return NextResponse.json({
    serp_results,
    keywords_analyses: keywords_selectionnes.map((kw) => kw.keyword),
    cout: {
      nb_appels,
      cout_unitaire: API_COSTS.dataforseo_serp,
      cout_total: nb_appels * API_COSTS.dataforseo_serp,
    },
  })
}
