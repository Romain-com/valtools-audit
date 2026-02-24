// Route Handler — Google PageSpeed Insights
// Responsabilité : mesurer les Core Web Vitals (score, LCP, CLS, INP)
//   pour chaque domaine en mobile et desktop
// ⚠️  Serveur uniquement — aucune clé API exposée côté client
// ⚠️  2 appels en parallèle par domaine (mobile + desktop)
// ⚠️  Si erreur sur un domaine → résultat partiel, ne jamais bloquer les autres

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { ResultatPageSpeed } from '@/types/schema-digital'

// URL de l'API PageSpeed Insights
const PAGESPEED_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

// Timeout par appel — 45s nécessaire pour les sites lents (30s provoque des timeouts en prod)
const TIMEOUT_MS = 45_000

// ─── Types internes PageSpeed ─────────────────────────────────────────────────

interface PageSpeedAudit {
  numericValue?: number
}

interface PageSpeedResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number }
    }
    audits?: {
      'largest-contentful-paint'?: PageSpeedAudit
      'cumulative-layout-shift'?: PageSpeedAudit
      'interaction-to-next-paint'?: PageSpeedAudit
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrait les métriques Core Web Vitals depuis une réponse PageSpeed.
 */
function extraireMetriques(data: PageSpeedResponse) {
  const lr = data.lighthouseResult
  return {
    score: Math.round((lr?.categories?.performance?.score ?? 0) * 100),
    lcp: Math.round(((lr?.audits?.['largest-contentful-paint']?.numericValue ?? 0) / 1000) * 10) / 10,
    cls: Math.round((lr?.audits?.['cumulative-layout-shift']?.numericValue ?? 0) * 100) / 100,
    inp: Math.round(lr?.audits?.['interaction-to-next-paint']?.numericValue ?? 0),
  }
}

/**
 * Effectue les 2 appels PageSpeed (mobile + desktop) en parallèle pour un domaine.
 * En cas d'erreur, retourne un résultat avec erreur sans bloquer le reste.
 */
async function appelPageSpeed(domaine: string, apiKey: string): Promise<ResultatPageSpeed> {
  const params = (strategy: 'mobile' | 'desktop') => ({
    url: `https://${domaine}`,
    strategy,
    key: apiKey,
  })

  try {
    const [mobile, desktop] = await Promise.all([
      axios.get<PageSpeedResponse>(PAGESPEED_URL, { params: params('mobile'), timeout: TIMEOUT_MS }),
      axios.get<PageSpeedResponse>(PAGESPEED_URL, { params: params('desktop'), timeout: TIMEOUT_MS }),
    ])

    return {
      domaine,
      mobile: extraireMetriques(mobile.data),
      desktop: extraireMetriques(desktop.data),
    }
  } catch (err) {
    // Erreur sur ce domaine — retourner un résultat vide sans bloquer les autres
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error(`[PageSpeed] Erreur pour ${domaine} :`, message)
    return {
      domaine,
      mobile: null,
      desktop: null,
      erreur: message,
    }
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { domaines } = body as { domaines?: string[] }

  if (!domaines?.length) {
    return NextResponse.json({ erreur: 'Paramètre domaines manquant ou vide' }, { status: 400 })
  }

  const apiKey = process.env.PAGESPEED_API_KEY
  if (!apiKey) {
    return NextResponse.json({ erreur: 'Variable PAGESPEED_API_KEY manquante' }, { status: 500 })
  }

  // Limiter à 3 domaines maximum
  const domainesAAnalyser = domaines.slice(0, 3)

  // ─── Appels en parallèle par domaine (chaque domaine lance 2 appels) ───────
  const resultats = await Promise.all(
    domainesAAnalyser.map((domaine) => appelPageSpeed(domaine, apiKey))
  )

  return NextResponse.json({
    resultats,
    cout: {
      // 2 appels par domaine (mobile + desktop), API gratuite
      nb_appels: domainesAAnalyser.length * 2,
      cout_unitaire: API_COSTS.pagespeed,
      cout_total: 0,
    },
  })
}
