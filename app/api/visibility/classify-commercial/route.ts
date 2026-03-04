// Route Handler — Classification GPT des domaines de la SERP consolidée
// Un seul appel gpt-5-mini pour classer tous les domaines en une fois
// ⚠️ gpt-5-mini : max_completion_tokens (pas max_tokens), pas de response_format, pas de temperature

import { NextRequest, NextResponse } from 'next/server'
import axios, { isAxiosError } from 'axios'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const {
      domains,
      keyword,
      referenceDomain,
    }: { domains: string[]; keyword: string; referenceDomain: string } = await req.json()

    if (!domains?.length) {
      return NextResponse.json({ classifications: [] })
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-5-mini',
        max_completion_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `Tu classifies des domaines web apparaissant dans des résultats Google liés au tourisme. Catégories : OFFICIEL (site officiel destination, OT, station, commune), INTERMEDIAIRE (OTA, agrégateur, comparateur : Booking, Airbnb, Tripadvisor, Skiplanet, Gites de France...), MEDIA (presse, blogs, guides : Routard, presse locale...), INFORMATION (Wikipedia, gouvernement, institutionnel non-commercial). Réponds UNIQUEMENT avec un objet JSON valide sans markdown, sans commentaires, sans texte avant ou après. Format exact : {"classifications":[{"domain":"string","type":"OFFICIEL|INTERMEDIAIRE|MEDIA|INFORMATION"}]}`,
          },
          {
            role: 'user',
            content: `Destination / lieu : ${keyword}\nDomaine de référence : ${referenceDomain}\nDomaines à classifier : ${JSON.stringify(domains)}`,
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
    console.log('[classify-commercial] raw:', raw.slice(0, 200))

    let classifications: { domain: string; type: string }[] = []

    try {
      const cleaned = raw.replace(/```json\n?|```/g, '').trim() || '{}'
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
      classifications = parsed.classifications ?? []
    } catch {
      // Fallback : classifications vides, les domainType resteront null
      console.error('[classify-commercial] JSON parse error')
    }

    return NextResponse.json({ classifications })
  } catch (err: unknown) {
    if (isAxiosError(err)) {
      const message = err.response?.data?.error?.message ?? err.message
      console.error('[classify-commercial] OpenAI error', err.response?.status, message)
      return NextResponse.json({ classifications: [] })
    }
    return NextResponse.json({ classifications: [] })
  }
}
