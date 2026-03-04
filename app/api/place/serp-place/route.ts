// Route Handler — SERP du lieu touristique (organique + Google Maps)
// + classification GPT des types d'acteurs
// ⚠️ Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { PlaceSerpResult, PlaceGMB } from '@/types/place'

const LOGIN = process.env.DATAFORSEO_LOGIN!
const PASSWORD = process.env.DATAFORSEO_PASSWORD!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

/** Classification des acteurs SERP avec fallback regex */
function classifyActorByRules(
  domain: string,
  title: string,
  description: string
): PlaceSerpResult['actorType'] {
  const text = (domain + ' ' + title + ' ' + description).toLowerCase()
  if (/(viator|getyourguide|tripadvisor|booking|airbnb|expedia|weekendesk|escapades|rando|sortir|loisirs|activity)/.test(text))
    return 'AGGREGATEUR'
  if (/(le monde|figaro|nice-matin|dauphine|france bleu|blog|guide|magazine|presse|journal)/.test(text))
    return 'MEDIA'
  if (/(mairie|commune|ville-de|agglo|departement|region\.|office.*tourisme|ot-|tourisme\.|pays-de)/.test(text))
    return 'COMMUNE_OT'
  return 'AUTRE'
}

export async function POST(req: NextRequest) {
  try {
    const { placeName, commune }: { placeName: string; commune: string } = await req.json()

    if (!placeName?.trim()) {
      return NextResponse.json({ error: 'Nom du lieu manquant' }, { status: 400 })
    }

    const auth = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64')
    const headers = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    }

    // ─── Appel 1 : SERP organique sur le nom du lieu ───────────────────────────
    const serpResponse = await axios.post(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
      [{ keyword: placeName.trim(), language_code: 'fr', location_code: 2250, depth: 10 }],
      { headers, timeout: 60_000 }
    )

    const serpTask = serpResponse.data?.tasks?.[0]
    if (serpTask?.status_code !== 20000) {
      return NextResponse.json(
        { error: serpTask?.status_message ?? 'Erreur DataForSEO SERP', code: serpTask?.status_code },
        { status: 502 }
      )
    }

    const organicItems: Array<Record<string, unknown>> =
      (serpTask?.result?.[0]?.items ?? []).filter((i: Record<string, unknown>) => i.type === 'organic')

    const rawSerpResults = organicItems.map((item) => ({
      domain: (item.domain as string) ?? '',
      url: (item.url as string) ?? '',
      title: (item.title as string) ?? '',
      description: (item.description as string) ?? '',
      position: (item.rank_group as number) ?? 0,
    })).filter((r) => r.domain)

    // ─── Appel 2 : Google Maps sur le nom du lieu ──────────────────────────────
    let placeGMB: PlaceGMB = {
      exists: false,
      name: null,
      rating: null,
      reviewCount: null,
      isClaimed: null,
      address: null,
      phone: null,
    }

    try {
      const mapsResponse = await axios.post(
        'https://api.dataforseo.com/v3/serp/google/maps/live/advanced',
        [{ keyword: placeName.trim(), language_code: 'fr', location_code: 2250, depth: 10 }],
        { headers, timeout: 60_000 }
      )

      const mapsTask = mapsResponse.data?.tasks?.[0]
      const mapsItems: Array<Record<string, unknown>> =
        (mapsTask?.result?.[0]?.items ?? []).filter((i: Record<string, unknown>) => i.type === 'maps_search')

      if (mapsItems.length > 0) {
        const first = mapsItems[0]
        placeGMB = {
          exists: true,
          name: (first.title as string) ?? null,
          rating: (first.rating as Record<string, unknown>)?.value as number ?? null,
          reviewCount: (first.rating as Record<string, unknown>)?.votes_count as number ?? null,
          isClaimed: (first.is_claimed as boolean) ?? null,
          address: (first.address as string) ?? null,
          phone: (first.phone as string) ?? null,
        }
      }
    } catch {
      // GMB non bloquant — garder placeGMB avec exists: false
    }

    // ─── Classification GPT des acteurs organiques ─────────────────────────────
    let placeSerp: PlaceSerpResult[] = []

    try {
      const classResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-5-mini',
          max_completion_tokens: 1000,
          messages: [
            {
              role: 'system',
              content: `Tu classifies des résultats de recherche Google liés à un lieu touristique.
Catégories :
- LIEU_OFFICIEL : site officiel du lieu lui-même
- COMMUNE_OT : site de la commune, mairie, office de tourisme local, département, région
- AGGREGATEUR : site agrégateur d'activités ou hébergements (Viator, GetYourGuide, Tripadvisor, Booking...)
- MEDIA : presse, blogs, guides touristiques
- AUTRE : tout le reste
Réponds uniquement en JSON : { "classifications": [{ "domain": string, "actorType": string }] }`,
            },
            {
              role: 'user',
              content: `Lieu analysé : ${placeName}, commune : ${commune ?? ''}\nSites à classifier : ${JSON.stringify(rawSerpResults.map((r) => ({ domain: r.domain, title: r.title, description: r.description })))}`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        }
      )

      const raw: string = classResponse.data?.choices?.[0]?.message?.content || '{}'
      const parsed = JSON.parse(raw.replace(/```json\n?|```/g, '').trim() || '{}')
      const classifications: Array<{ domain: string; actorType: string }> = parsed.classifications ?? []
      const classMap = new Map(classifications.map((c) => [c.domain, c.actorType]))

      placeSerp = rawSerpResults.map((r) => ({
        ...r,
        actorType: (classMap.get(r.domain) as PlaceSerpResult['actorType']) ??
          classifyActorByRules(r.domain, r.title, r.description),
      }))
    } catch {
      // Fallback règles regex si OpenAI échoue
      placeSerp = rawSerpResults.map((r) => ({
        ...r,
        actorType: classifyActorByRules(r.domain, r.title, r.description),
      }))
    }

    // Coût estimé : ~2 appels DataForSEO + 1 OpenAI
    return NextResponse.json({
      placeSerp,
      placeGMB,
      cout: { nb_appels: 3, cout_unitaire: 0.003, cout_total: 0.009 },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
