// Route Handler — Génération du diagnostic GPT pour l'analyse d'un lieu touristique
// Produit un headline percutant et 2-3 recommandations actionnables
// ⚠️ Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

interface DiagnosticPayload {
  placeName: string
  commune: string
  placeExists: boolean
  communeMentionsPlace: boolean
  placeVisibilityVsCommune: 'SUPERIEURE' | 'EQUIVALENTE' | 'INFERIEURE' | 'INEXISTANTE'
  placeTraffic: number | null
  communeTraffic: number | null
  gmbExists: boolean
  gmbIsClaimed: boolean | null
  serpCount: number
}

export async function POST(req: NextRequest) {
  try {
    const payload: DiagnosticPayload = await req.json()

    const {
      placeName,
      commune,
      placeExists,
      communeMentionsPlace,
      placeVisibilityVsCommune,
      placeTraffic,
      communeTraffic,
      gmbExists,
      gmbIsClaimed,
      serpCount,
    } = payload

    const gmbStatus = !gmbExists
      ? "n'existe pas"
      : gmbIsClaimed === false
      ? 'existe mais non réclamée'
      : 'existe et est réclamée'

    const userMessage = `Lieu : ${placeName} | Commune : ${commune}
- Existence digitale (site web ou GMB) : ${placeExists ? 'oui' : 'non'}
- Fiche Google Maps : ${gmbStatus}
- Trafic organique lieu : ${placeTraffic !== null ? `${placeTraffic} visites/mois estimées` : 'non mesuré'}
- Trafic organique commune : ${communeTraffic !== null ? `${communeTraffic} visites/mois estimées` : 'non mesuré'}
- Visibilité relative : ${placeVisibilityVsCommune}
- La commune mentionne ce lieu dans ses contenus Google : ${communeMentionsPlace ? 'oui' : 'non'}
- Nombre de sites qui parlent du lieu sur Google : ${serpCount}

Génère :
- "headline" : une phrase choc maximum 15 mots
- "recommendations" : 2 à 3 constats actionnables courts en français`

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-5-mini',
        max_completion_tokens: 400,
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en marketing digital touristique. Tu génères des diagnostics percutants pour des gestionnaires de lieux touristiques. Sois direct, chiffré, actionnable. Réponds en JSON : { "headline": string, "recommendations": string[] }`,
          },
          {
            role: 'user',
            content: userMessage,
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

    const raw: string = response.data?.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw.replace(/```json\n?|```/g, '').trim() || '{}')

    return NextResponse.json({
      headline: parsed.headline ?? '',
      recommendations: parsed.recommendations ?? [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
