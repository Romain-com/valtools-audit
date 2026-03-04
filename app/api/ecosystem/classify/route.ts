// Route Handler — Classification des sites par OpenAI (acteurs officiels vs externes)
// Retourne uniquement les sites identifiés comme officiels de la destination
// ⚠️ Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { DetectedSite, ClassifiedSite } from '@/types/ecosystem'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

const SYSTEM_PROMPT = `Tu analyses des sites web liés à une destination touristique française.
Pour chaque site, tu dois :
1) Décider s'il est un acteur OFFICIEL de la destination ou un acteur EXTERNE.
   - Officiel : office de tourisme, site de station/domaine skiable, mairie, intercommunalité, département, région, parc naturel, syndicat d'initiative, SPL touristique.
   - Externe : OTA (Booking, Airbnb, Skiplanet…), média (Routard, TripAdvisor, presse…), agrégateur, Wikipedia, réseau social.
2) Si officiel, lui attribuer une catégorie :
   - OT : office de tourisme, syndicat d'initiative, bureau d'accueil touristique
   - STATION : site commercial d'une station de ski, domaine skiable, parc de loisirs
   - INSTITUTIONNEL : mairie, communauté de communes, département, région
   - PARC : parc naturel régional ou national, réserve naturelle
   - AUTRE_OFFICIEL : autre acteur officiel non classifiable ci-dessus

Réponds UNIQUEMENT avec un JSON valide de la forme :
{ "sites": [{ "domain": string, "isOfficial": boolean, "category": "OT"|"STATION"|"INSTITUTIONNEL"|"PARC"|"AUTRE_OFFICIEL"|null, "confidence": "high"|"medium"|"low" }] }`

/** Fallback par règles regex si OpenAI échoue */
function classifyByRules(site: DetectedSite): ClassifiedSite {
  const d = site.domain.toLowerCase()
  const t = (site.title + ' ' + site.description).toLowerCase()

  if (/(office.*tourisme|ot-|tourisme\.|maison.*tourisme|syndicat.*initiative)/.test(d + t))
    return { ...site, isOfficial: true, category: 'OT', confidence: 'low' }
  if (/(mairie|ville-de|commune-|agglo|communaute|departement|region\.)/.test(d))
    return { ...site, isOfficial: true, category: 'INSTITUTIONNEL', confidence: 'low' }
  if (/(parc.*naturel|pnr-|reserve.*naturelle)/.test(d + t))
    return { ...site, isOfficial: true, category: 'PARC', confidence: 'low' }
  if (/(ski|station|domaine|laux|alpe|tignes|courchevel|forfait)/.test(d + t))
    return { ...site, isOfficial: true, category: 'STATION', confidence: 'low' }

  return { ...site, isOfficial: false, category: null, confidence: 'low' }
}

export async function POST(req: NextRequest) {
  try {
    const { sites }: { sites: DetectedSite[] } = await req.json()

    if (!Array.isArray(sites) || sites.length === 0) {
      return NextResponse.json({ sites: [] })
    }

    let classifiedSites: ClassifiedSite[] = []
    let usedFallback = false

    try {
      const userMessage = JSON.stringify(
        sites.map((s) => ({ domain: s.domain, title: s.title, description: s.description, url: s.url }))
      )

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-5-mini',
          max_completion_tokens: 2000,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
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
      const results: Array<{ domain: string; isOfficial: boolean; category: string | null; confidence: string }> =
        parsed.sites ?? []

      // Fusionner avec les données détectées originales
      const resultsByDomain = new Map(results.map((r) => [r.domain, r]))

      classifiedSites = sites.map((site) => {
        const classification = resultsByDomain.get(site.domain)
        if (!classification) return classifyByRules(site)

        return {
          ...site,
          isOfficial: classification.isOfficial,
          category: (classification.category as ClassifiedSite['category']) ?? null,
          confidence: (classification.confidence as ClassifiedSite['confidence']) ?? 'low',
        }
      })
    } catch {
      // Fallback règles regex si OpenAI échoue
      usedFallback = true
      classifiedSites = sites.map(classifyByRules)
    }

    // Ne retourner que les acteurs officiels
    const officialSites = classifiedSites.filter((s) => s.isOfficial)

    // Coût estimé OpenAI gpt-4o-mini : ~$0.00015 / 1K input tokens (~0.0015$ par appel typique)
    return NextResponse.json({
      sites: officialSites,
      usedFallback,
      cout: { nb_appels: 1, cout_unitaire: 0.0015, cout_total: 0.0015 },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
