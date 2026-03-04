// Route Handler — Enrichissement SEO des sites via Haloscan (bulk)
// Retourne les métriques de trafic et mots-clés pour chaque domaine
// ⚠️ Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { HaloscanData } from '@/types/ecosystem'

const HALOSCAN_API_KEY = process.env.HALOSCAN_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const { domains }: { domains: string[] } = await req.json()

    if (!Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json({ enrichments: {} })
    }

    // Initialiser tous les domaines comme non trouvés (fallback)
    const enrichments: Record<string, HaloscanData> = {}
    for (const domain of domains) {
      enrichments[domain] = {
        domain,
        totalTraffic: null,
        uniqueKeywords: null,
        totalTop10: null,
        totalTop3: null,
        haloscanFound: false,
      }
    }

    try {
      const response = await axios.post(
        'https://api.haloscan.com/api/domains/bulk',
        {
          inputs: domains,
          mode: 'auto',
          order_by: 'total_traffic',
          order: 'desc',
          lineCount: 50,
        },
        {
          headers: {
            'haloscan-api-key': HALOSCAN_API_KEY,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        }
      )

      const results: Array<Record<string, unknown>> = response.data?.results ?? []

      for (const result of results) {
        const domainKey = (result.url as string) ?? ''
        if (!domainKey || !enrichments[domainKey]) continue

        // Vérifier si le site est indexé
        if ((result as Record<string, unknown>).errorCode === 'SITE_NOT_FOUND') continue

        enrichments[domainKey] = {
          domain: domainKey,
          totalTraffic: (result.total_traffic as number) ?? null,
          uniqueKeywords: (result.unique_keywords as number) ?? null,
          totalTop10: (result.total_top_10 as number) ?? null,
          totalTop3: (result.total_top_3 as number) ?? null,
          haloscanFound: true,
        }
      }
    } catch {
      // Si Haloscan échoue, retourner les domaines avec haloscanFound: false
      // (déjà initialisés dans la boucle ci-dessus)
    }

    // Coût Haloscan : 1 crédit site par appel bulk (compte les domaines trouvés)
    const found = Object.values(enrichments).filter((e) => e.haloscanFound).length
    return NextResponse.json({
      enrichments,
      cout: { nb_appels: 1, cout_unitaire: found, cout_total: found },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
