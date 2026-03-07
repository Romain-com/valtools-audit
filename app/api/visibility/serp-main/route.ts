// Route Handler — SERP principal + PAA + Knowledge Graph + Local Pack
// DataForSEO SERP organic, depth 10, people_also_ask activées

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { SerpOrganic, PaaQuestion, KnowledgeGraph, LocalPack, GoogleReviews, PaidAd, HotelsPackItem, CompareSiteItem } from '@/types/visibility'

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN!
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD!

function getAuth(): string {
  return Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
}

function extractPaaItems(items: unknown[]): PaaQuestion[] {
  // DataForSEO retourne UN bloc people_also_ask dont les questions sont dans .items[]
  // Chaque question est un people_also_ask_element avec .title et .expanded_element[].description
  const paaBlock = items.find((i: unknown) => (i as { type: string }).type === 'people_also_ask') as {
    items?: {
      title?: string
      expanded_element?: { description?: string; url?: string; domain?: string }[]
    }[]
  } | undefined

  if (!paaBlock) return []

  return (paaBlock.items ?? []).map((el) => {
    const expanded = el.expanded_element?.[0]
    return {
      question: el.title ?? '',
      answer: expanded?.description ?? null,
      sourceUrl: expanded?.url ?? null,
      sourceDomain: expanded?.domain ?? null,
    }
  }).filter((q) => q.question)
}

export async function POST(req: NextRequest) {
  try {
    const { keyword, referenceDomain }: { keyword: string; referenceDomain: string } = await req.json()

    if (!keyword?.trim() || !referenceDomain?.trim()) {
      return NextResponse.json({ error: 'keyword et referenceDomain sont requis' }, { status: 400 })
    }

    const cleanDomain = referenceDomain.replace('www.', '')

    const organicResponse = await axios.post(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
      [{ keyword, language_code: 'fr', location_code: 2250, depth: 20, people_also_ask_click_depth: 1 }],
      { headers: { Authorization: `Basic ${getAuth()}`, 'Content-Type': 'application/json' }, timeout: 60_000 }
    )

    // Les items paid sont inclus dans la réponse organique quand des annonces existent
    const items: unknown[] = organicResponse.data?.tasks?.[0]?.result?.[0]?.items ?? []

    // Résultats organiques
    const serpMain: SerpOrganic[] = items
      .filter((i: unknown) => (i as { type: string }).type === 'organic')
      .map((i: unknown) => {
        const item = i as {
          domain?: string
          url?: string
          title?: string
          description?: string
          rank_absolute?: number
        }
        return {
          domain: item.domain ?? '',
          url: item.url ?? '',
          title: item.title ?? '',
          description: item.description ?? '',
          position: item.rank_absolute ?? 0,
          isReferenceDomain:
            (item.domain ?? '').replace('www.', '') === cleanDomain,
        }
      })

    // PAA
    const paaMain: PaaQuestion[] = extractPaaItems(items)

    // Knowledge Graph
    let knowledgeGraph: KnowledgeGraph = {
      exists: false,
      title: null,
      description: null,
      hasPhone: false,
      hasAddress: false,
      hasSocialProfiles: false,
    }

    const kgItem = items.find((i: unknown) => (i as { type: string }).type === 'knowledge_graph') as {
      title?: string
      description?: string
      items?: { type?: string; title?: string }[]
    } | undefined

    if (kgItem) {
      const kgItems = kgItem.items ?? []
      knowledgeGraph = {
        exists: true,
        title: kgItem.title ?? null,
        description: kgItem.description ?? null,
        hasPhone: kgItems.some(
          (it) => it.type === 'knowledge_graph_row_item' && it.title?.toLowerCase().includes('téléphone')
        ),
        hasAddress: kgItems.some(
          (it) => it.type === 'knowledge_graph_row_item' && it.title?.toLowerCase().includes('adresse')
        ),
        hasSocialProfiles: kgItems.some((it) => it.type === 'knowledge_graph_carousel_item'),
      }
    }

    // Local Pack
    let localPack: LocalPack = { exists: false, entries: [] }

    const lpItem = items.find((i: unknown) => (i as { type: string }).type === 'local_pack') as {
      items?: { title?: string; domain?: string; rating?: { value?: number; votes_count?: number } }[]
    } | undefined

    if (lpItem) {
      localPack = {
        exists: true,
        entries: (lpItem.items ?? []).slice(0, 3).map((e) => ({
          name: e.title ?? '',
          domain: e.domain ?? null,
          rating: e.rating?.value ?? null,
          reviewCount: e.rating?.votes_count ?? null,
        })),
      }
    }

    // Google Reviews — note Google visible dans le SERP (bloc google_reviews)
    let googleReviews: GoogleReviews = { exists: false, rating: null, reviewCount: null, title: null }

    const grItem = items.find((i: unknown) => (i as { type: string }).type === 'google_reviews') as {
      title?: string
      rating?: { value?: number; votes_count?: number }
      reviews_count?: number
    } | undefined

    if (grItem) {
      googleReviews = {
        exists: true,
        title: grItem.title ?? null,
        rating: grItem.rating?.value ?? null,
        reviewCount: grItem.rating?.votes_count ?? grItem.reviews_count ?? null,
      }
    }

    // Publicités Google — items de type 'paid' inclus dans la réponse organique
    const paidAdsMain: PaidAd[] = items
      .filter((i: unknown) => (i as { type: string }).type === 'paid')
      .map((i: unknown) => {
        const item = i as {
          domain?: string
          url?: string
          title?: string
          description?: string
          rank_absolute?: number
        }
        const domain = item.domain ?? ''
        return {
          domain,
          url: item.url ?? '',
          title: item.title ?? '',
          description: item.description ?? '',
          position: item.rank_absolute ?? 0,
          isReferenceDomain:
            domain.replace('www.', '') === cleanDomain,
        }
      })

    // Hotels Pack — résultats d'hébergements Google (type hotels_pack)
    const hotelsPackBlock = items.find((i: unknown) => (i as { type: string }).type === 'hotels_pack') as {
      items?: {
        title?: string
        price?: { current?: number; currency?: string; displayed_price?: string }
        domain?: string | null
        url?: string | null
        is_paid?: boolean
        rating?: { value?: number } | null
      }[]
    } | undefined

    const hotelsPackMain: HotelsPackItem[] = (hotelsPackBlock?.items ?? []).map((el) => ({
      title: el.title ?? '',
      displayedPrice: el.price?.displayed_price ?? null,
      domain: el.domain ?? null,
      url: el.url ?? null,
      isPaid: el.is_paid ?? false,
      rating: el.rating?.value ?? null,
    }))

    // Compare Sites — agrégateurs/comparateurs mis en avant par Google
    const compareSitesBlock = items.find((i: unknown) => (i as { type: string }).type === 'compare_sites') as {
      items?: {
        title?: string
        url?: string
        domain?: string
        source?: string | null
      }[]
    } | undefined

    const compareSitesMain: CompareSiteItem[] = (compareSitesBlock?.items ?? [])
      .filter((el) => el.url && el.domain)
      .map((el) => ({
        title: el.title ?? '',
        url: el.url ?? '',
        domain: el.domain ?? '',
        source: el.source ?? null,
      }))

    return NextResponse.json({ serpMain, paaMain, knowledgeGraph, localPack, googleReviews, paidAdsMain, hotelsPackMain, compareSitesMain })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[visibility/serp-main]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
