// Route Handler — Génération GPT du headline + insights finaux
// Prompt contextuel selon type=destination ou type=place
// ⚠️ gpt-5-mini : max_completion_tokens, pas de temperature, pas de response_format

import { NextRequest, NextResponse } from 'next/server'
import axios, { isAxiosError } from 'axios'
import type { VisibilityParams, VisibilityScores, CommercialSectionData, PaaQuestion, SerpOrganic, RelatedKeyword, RankedKeyword } from '@/types/visibility'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

function buildUserPrompt(
  params: VisibilityParams,
  scores: VisibilityScores,
  serpMain: SerpOrganic[],
  paaMain: PaaQuestion[],
  hebergementData: CommercialSectionData,
  activitesData: CommercialSectionData,
  relatedKeywords: RelatedKeyword[],
  rankedKeywords: RankedKeyword[]
): string {
  const refPosition = serpMain.find((s) => s.isReferenceDomain)?.position ?? null
  const positionStr = refPosition ? `position ${refPosition}` : 'absent du top 10'

  const hebergRank = hebergementData.referenceDomainRank
  const activitesRank = activitesData.referenceDomainRank

  const coveredCount = relatedKeywords.filter((rk) =>
    rankedKeywords.some((rr) => rr.keyword.toLowerCase() === rk.keyword.toLowerCase())
  ).length
  const coveragePercent = relatedKeywords.length > 0
    ? Math.round((coveredCount / relatedKeywords.length) * 100)
    : 0

  const paaFromRef = paaMain.filter((q) =>
    q.sourceDomain?.includes(params.domain.replace('www.', ''))
  ).length

  if (params.type === 'destination') {
    return `Destination : ${params.keyword}
Domaine OT : ${params.domain}
Score global : ${scores.total}/100
- Présence nominale : ${scores.nominal}/25
- Résistance OTA : ${scores.commercial}/25
- Couverture sémantique : ${scores.semantic}/25
- Autorité de contenu : ${scores.content}/25

Position sur "${params.keyword}" : ${positionStr}
Rang domaine sur SERP hébergement consolidée : ${hebergRank ?? 'absent'}
Rang domaine sur SERP activités consolidée : ${activitesRank ?? 'absent'}
Mots-clés disponibles (vol ≥ 100) : ${relatedKeywords.length} | Positionnés : ${coveredCount} (${coveragePercent}%)
PAA détectées (SERP principale) : ${paaMain.length} | Répondues par le domaine : ${paaFromRef}

Génère :
- "headline" : phrase choc ≤ 15 mots
- "insights" : 3 constats actionnables chiffrés en français

Réponds UNIQUEMENT avec un objet JSON valide sans markdown, format : {"headline":"...","insights":["...","...","..."]}`
  }

  return `Lieu touristique : ${params.keyword}
Commune : ${params.commune ?? ''}
Domaine de référence : ${params.domain}
Score global : ${scores.total}/100
- Présence sur le nom du lieu : ${scores.nominal}/25
- Résistance agrégateurs : ${scores.commercial}/25
- Couverture sémantique : ${scores.semantic}/25
- Autorité de contenu : ${scores.content}/25

Position sur "${params.keyword}" : ${positionStr}
Rang domaine sur SERP hébergement consolidée : ${hebergRank ?? 'absent'}
Rang domaine sur SERP activités consolidée : ${activitesRank ?? 'absent'}
Mots-clés disponibles (vol ≥ 100) : ${relatedKeywords.length} | Positionnés : ${coveredCount} (${coveragePercent}%)
PAA détectées : ${paaMain.length} | Répondues par le domaine : ${paaFromRef}

Génère :
- "headline" : phrase choc ≤ 15 mots centrée sur la visibilité du lieu
- "insights" : 3 constats actionnables chiffrés en français

Réponds UNIQUEMENT avec un objet JSON valide sans markdown, format : {"headline":"...","insights":["...","...","..."]}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { params, scores, serpMain, paaMain, hebergementData, activitesData, relatedKeywords, rankedKeywords } = body

    if (!params?.keyword || !params?.domain) {
      return NextResponse.json({ error: 'params incomplets' }, { status: 400 })
    }

    const userPrompt = buildUserPrompt(
      params, scores, serpMain ?? [], paaMain ?? [],
      hebergementData, activitesData,
      relatedKeywords ?? [], rankedKeywords ?? []
    )

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-5-mini',
        max_completion_tokens: 400,
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en marketing digital touristique. Tu génères des diagnostics percutants pour des professionnels du tourisme. Sois direct, chiffré, orienté action.',
          },
          {
            role: 'user',
            content: userPrompt,
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

    const raw: string = response.data?.choices?.[0]?.message?.content || ''
    console.log('[visibility/insights] raw:', raw.slice(0, 200))

    let headline = ''
    let insights: string[] = []

    try {
      const cleaned = raw.replace(/```json\n?|```/g, '').trim() || '{}'
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
      headline = parsed.headline ?? ''
      insights = parsed.insights ?? []
    } catch {
      console.error('[visibility/insights] JSON parse error')
    }

    return NextResponse.json({ headline, insights })
  } catch (err: unknown) {
    if (isAxiosError(err)) {
      const message = err.response?.data?.error?.message ?? err.message
      console.error('[visibility/insights] OpenAI error', err.response?.status, message)
      return NextResponse.json({ headline: '', insights: [] })
    }
    return NextResponse.json({ headline: '', insights: [] })
  }
}
