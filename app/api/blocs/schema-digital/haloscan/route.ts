// Route Handler — Haloscan SEO
// Responsabilité : métriques SEO Haloscan pour UN domaine avec retry www.
// Retourne { domaine, donnees_valides, resultat } — la décision de fallback appartient à l'orchestrateur.
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { ResultatHaloscan } from '@/types/schema-digital'

const HALOSCAN_URL = 'https://api.haloscan.com/api/domains/overview'
const TIMEOUT_MS = 30_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function zeroHaloscan(domaine: string): ResultatHaloscan {
  return {
    domaine,
    total_keywords: 0,
    total_traffic: 0,
    top_3_positions: 0,
    top_10_positions: 0,
    visibility_index: 0,
    traffic_value: 0,
    site_non_indexe: true,
    source: 'haloscan',
  }
}

async function appelerHaloscan(
  domaine: string,
  apiKey: string
): Promise<{ donnees_valides: boolean; resultat: ResultatHaloscan }> {
  const response = await axios.post(
    HALOSCAN_URL,
    { input: domaine, mode: 'domain', requested_data: ['metrics', 'best_keywords', 'best_pages'] },
    { headers: { 'haloscan-api-key': apiKey }, timeout: TIMEOUT_MS }
  )

  const metrics = (response.data.metrics as Record<string, number | string>) ?? {}
  const estVide =
    metrics.errorCode === 'SITE_NOT_FOUND' ||
    (!metrics.total_keyword_count && !metrics.total_traffic)

  if (estVide) {
    return { donnees_valides: false, resultat: zeroHaloscan(domaine) }
  }

  return {
    donnees_valides: true,
    resultat: {
      domaine,
      total_keywords: (metrics.total_keyword_count as number) ?? 0,
      total_traffic: (metrics.total_traffic as number) ?? 0,
      top_3_positions: (metrics.top_3_positions as number) ?? 0,
      top_10_positions: (metrics.top_10_positions as number) ?? 0,
      visibility_index: (metrics.visibility_index as number) ?? 0,
      traffic_value: (metrics.traffic_value as number) ?? 0,
      site_non_indexe: false,
      source: 'haloscan',
    },
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { domaine } = body as { domaine?: string }

  if (!domaine) {
    return NextResponse.json({ erreur: 'Paramètre domaine manquant' }, { status: 400 })
  }

  const apiKey = process.env.HALOSCAN_API_KEY
  if (!apiKey) {
    return NextResponse.json({ erreur: 'Variable HALOSCAN_API_KEY manquante' }, { status: 500 })
  }

  // Tentative 1 — domaine nu
  try {
    const res1 = await appelerHaloscan(domaine, apiKey)
    if (res1.donnees_valides) {
      return NextResponse.json({
        domaine,
        donnees_valides: true,
        resultat: res1.resultat,
        cout: { nb_appels: 1, cout_unitaire: API_COSTS.haloscan, cout_total: API_COSTS.haloscan },
      })
    }
  } catch (err) {
    console.warn(`[Haloscan] Erreur domaine nu ${domaine} :`, err)
  }

  // Tentative 2 — retry www.
  if (!domaine.startsWith('www.')) {
    const domaineWww = `www.${domaine}`
    console.warn(`[Haloscan] ${domaine} sans données → retry ${domaineWww}`)
    try {
      const res2 = await appelerHaloscan(domaineWww, apiKey)
      if (res2.donnees_valides) {
        return NextResponse.json({
          domaine,
          donnees_valides: true,
          resultat: { ...res2.resultat, domaine },  // domaine original conservé
          cout: { nb_appels: 2, cout_unitaire: API_COSTS.haloscan, cout_total: 2 * API_COSTS.haloscan },
        })
      }
    } catch (err) {
      console.warn(`[Haloscan] Erreur www ${domaineWww} :`, err)
    }
  }

  // Aucune donnée — retourner donnees_valides: false pour déclencher le fallback DataForSEO
  console.warn(`[Haloscan] ${domaine} non indexé (ni nu ni www)`)
  return NextResponse.json({
    domaine,
    donnees_valides: false,
    resultat: zeroHaloscan(domaine),
    cout: { nb_appels: domaine.startsWith('www.') ? 1 : 2, cout_unitaire: API_COSTS.haloscan, cout_total: (domaine.startsWith('www.') ? 1 : 2) * API_COSTS.haloscan },
  })
}
