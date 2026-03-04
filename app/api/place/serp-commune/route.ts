// Route Handler — SERP sur le nom de la commune
// Détecte si les contenus de la commune mentionnent le lieu touristique
// ⚠️ Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { CommuneSerpResult } from '@/types/place'

const LOGIN = process.env.DATAFORSEO_LOGIN!
const PASSWORD = process.env.DATAFORSEO_PASSWORD!

/** Extrait le premier mot significatif du nom du lieu (ignore les mots génériques) */
function getKeyWord(placeName: string): string {
  const genericWords = new Set(['base', 'lac', 'site', 'parc', 'domaine', 'espace', 'centre', 'complexe', 'plage', 'forêt', 'foret', 'col', 'pont', 'tour', 'château', 'chateau'])
  const words = placeName.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  const significant = words.find((w) => !genericWords.has(w))
  return significant ?? words[0] ?? placeName.toLowerCase()
}

export async function POST(req: NextRequest) {
  try {
    const { commune, placeName }: { commune: string; placeName: string } = await req.json()

    if (!commune?.trim()) {
      return NextResponse.json({ error: 'Commune manquante' }, { status: 400 })
    }

    const auth = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64')

    const response = await axios.post(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
      [{ keyword: commune.trim(), language_code: 'fr', location_code: 2250, depth: 10 }],
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      }
    )

    const task = response.data?.tasks?.[0]
    if (task?.status_code !== 20000) {
      return NextResponse.json(
        { error: task?.status_message ?? 'Erreur DataForSEO', code: task?.status_code },
        { status: 502 }
      )
    }

    const items: Array<Record<string, unknown>> =
      (task?.result?.[0]?.items ?? []).filter((i: Record<string, unknown>) => i.type === 'organic')

    const keyWord = getKeyWord(placeName ?? '')

    const communeSerp: CommuneSerpResult[] = items
      .filter((item) => item.domain)
      .map((item) => {
        const title = ((item.title as string) ?? '').toLowerCase()
        const description = ((item.description as string) ?? '').toLowerCase()
        const mentionsPlace = title.includes(keyWord) || description.includes(keyWord)

        return {
          domain: (item.domain as string) ?? '',
          url: (item.url as string) ?? '',
          title: (item.title as string) ?? '',
          description: (item.description as string) ?? '',
          position: (item.rank_group as number) ?? 0,
          mentionsPlace,
        }
      })

    return NextResponse.json({
      communeSerp,
      cout: { nb_appels: 1, cout_unitaire: 0.003, cout_total: 0.003 },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
