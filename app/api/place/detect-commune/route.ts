// Route Handler — Détection de la commune de rattachement d'un lieu touristique
// Appelle OpenAI pour identifier la commune à partir du nom du lieu
// ⚠️ Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios, { isAxiosError } from 'axios'
import type { CommuneDetection } from '@/types/place'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

/** Extrait la commune depuis une réponse texte libre si le JSON échoue */
function extractCommuneFromText(text: string): string {
  // Cherche des patterns comme "commune de X", "rattaché à X", "situé à X", etc.
  const patterns = [
    /commune\s+(?:de\s+)?[«"]?([A-ZÀ-Ü][a-zà-ü\-']+(?:\s+[a-zà-ü\-']+)*)[»"]?/i,
    /rattach[eé]\s+(?:à|a)\s+[«"]?([A-ZÀ-Ü][a-zà-ü\-']+(?:\s+[a-zà-ü\-']+)*)[»"]?/i,
    /situ[eé]\s+(?:à|dans\s+la\s+commune\s+de)\s+[«"]?([A-ZÀ-Ü][a-zà-ü\-']+(?:\s+[a-zà-ü\-']+)*)[»"]?/i,
    /^([A-ZÀ-Ü][a-zà-ü\-']+(?:[-\s][A-Za-zà-ü\-']+)*)\s*$/m,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { placeName }: { placeName: string } = await req.json()

    if (!placeName?.trim()) {
      return NextResponse.json({ error: 'Nom du lieu manquant' }, { status: 400 })
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-5-mini',
        max_completion_tokens: 300,
        messages: [
          {
            role: 'system',
            content: `Tu es un expert de la géographie touristique française. Réponds UNIQUEMENT avec un objet JSON valide sans markdown, sans commentaires, sans texte avant ou après. Format exact : {"commune":"NomDeLaCommune","confidence":"high","reasoning":"explication courte"}`,
          },
          {
            role: 'user',
            content: `Quelle est la commune française de rattachement de ce lieu touristique : ${placeName.trim()} ?\nRéponds uniquement avec le JSON.`,
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

    const choice = response.data?.choices?.[0]
    const raw: string = choice?.message?.content || ''
    console.log('[detect-commune] finish_reason:', choice?.finish_reason, '| raw:', raw.slice(0, 200))

    // Essai 1 : parser le JSON directement
    let commune = ''
    let confidence: CommuneDetection['confidence'] = 'low'
    let reasoning = ''

    try {
      const cleaned = raw.replace(/```json\n?|```/g, '').trim()
      // Extraire le premier objet JSON trouvé dans la réponse
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
      commune = parsed.commune ?? ''
      confidence = parsed.confidence ?? 'low'
      reasoning = parsed.reasoning ?? ''
    } catch {
      // Essai 2 : extraire la commune depuis le texte libre
      commune = extractCommuneFromText(raw)
      reasoning = raw.slice(0, 200)
    }

    const detection: CommuneDetection = { commune, confidence, reasoning }
    return NextResponse.json({ detection })
  } catch (err: unknown) {
    if (isAxiosError(err)) {
      const detail = JSON.stringify(err.response?.data)
      console.error('[detect-commune] OpenAI error', err.response?.status, detail)
      const message = err.response?.data?.error?.message ?? err.message
      return NextResponse.json({ error: message, detail }, { status: 502 })
    }
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
