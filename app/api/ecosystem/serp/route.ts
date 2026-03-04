// Route Handler — Détection des acteurs digitaux via DataForSEO SERP
// Reçoit un mot-clé, retourne les domaines organiques uniques détectés
// ⚠️ Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { DetectedSite } from '@/types/ecosystem'

const LOGIN = process.env.DATAFORSEO_LOGIN!
const PASSWORD = process.env.DATAFORSEO_PASSWORD!

export async function POST(req: NextRequest) {
  try {
    const { keyword } = await req.json()

    if (!keyword?.trim()) {
      return NextResponse.json({ error: 'Mot-clé manquant' }, { status: 400 })
    }

    const auth = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64')

    const response = await axios.post(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
      [{ keyword: keyword.trim(), language_code: 'fr', location_code: 2250, depth: 20 }],
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      }
    )

    const task = response.data?.tasks?.[0]
    const statusCode: number = task?.status_code ?? 0

    if (statusCode !== 20000) {
      return NextResponse.json(
        { error: task?.status_message ?? 'Erreur DataForSEO', code: statusCode },
        { status: 502 }
      )
    }

    const items: Array<Record<string, unknown>> = task?.result?.[0]?.items ?? []

    // Dédupliquer par domaine — conserver la meilleure position (la plus petite)
    const byDomain = new Map<string, DetectedSite>()

    // 1. Résultats organiques (source principale)
    const organicItems = items.filter((i) => i.type === 'organic')
    for (const item of organicItems) {
      const domain = (item.domain as string) ?? ''
      const rank = (item.rank_group as number) ?? null
      if (!domain) continue

      if (!byDomain.has(domain) || (rank !== null && rank < (byDomain.get(domain)!.serpPosition ?? Infinity))) {
        byDomain.set(domain, {
          domain,
          url: (item.url as string) ?? '',
          title: (item.title as string) ?? '',
          description: (item.description as string) ?? '',
          serpPosition: rank,
        })
      }
    }

    // 2. Local Pack — souvent la mairie, l'OT ou la station (domain sans position SERP organique)
    // Ces sites sont importants mais n'ont pas de rank_group dans le local pack
    const localPackItems = items.filter((i) => i.type === 'local_pack')
    for (const item of localPackItems) {
      // Le local pack contient un tableau d'items imbriqués
      const subItems = (item.items as Array<Record<string, unknown>>) ?? []
      for (const sub of subItems) {
        const domain = (sub.domain as string) ?? ''
        if (!domain || byDomain.has(domain)) continue
        byDomain.set(domain, {
          domain,
          url: (sub.url as string) ?? '',
          title: (sub.title as string) ?? '',
          description: (sub.snippet as string) ?? (sub.address as string) ?? '',
          serpPosition: null, // position locale, pas organique
        })
      }
    }

    const sites: DetectedSite[] = Array.from(byDomain.values())

    // Coût DataForSEO : ~0.003$ par requête SERP live advanced
    return NextResponse.json({
      sites,
      cout: { nb_appels: 1, cout_unitaire: 0.003, cout_total: 0.003 },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
