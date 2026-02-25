// Route Handler — /api/blocs/stocks-physiques/synthese
// Génère via GPT-4o-mini la synthèse narrative des stocks physiques
// Input : stocks finaux fusionnés (DATA Tourisme + SIRENE)

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { StocksPhysiquesFinaux } from '@/types/stocks-physiques'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

export async function POST(req: NextRequest) {
  try {
    const { destination, stocks }: { destination: string; stocks: StocksPhysiquesFinaux } =
      await req.json()

    if (!destination || !stocks) {
      return NextResponse.json({ error: 'destination et stocks requis' }, { status: 400 })
    }

    const { hebergements, activites, culture, services, total_stock_physique, taux_couverture_dt } =
      stocks

    const promptUser = `Destination touristique : ${destination}

Stock physique total recensé : ${total_stock_physique} établissements
Taux de couverture DATA Tourisme (% du stock SIRENE référencé) : ${taux_couverture_dt}%

Détail par catégorie :
- Hébergements : ${hebergements.total_unique} (dont ${hebergements.hotels} hôtels, ${hebergements.collectifs} collectifs, ${hebergements.locations} locations, ${hebergements.autres} autres)
- Activités & loisirs : ${activites.total_unique} (${activites.sports_loisirs} sports/loisirs, ${activites.visites_tours} visites/tours, ${activites.experiences} expériences)
- Culture & patrimoine : ${culture.total_unique}
- Services touristiques : ${services.total_unique} (dont ${services.offices_tourisme} offices de tourisme)

Recoupement sources :
- Établissements dans les deux sources (DATA Tourisme + SIRENE) : ${hebergements.dont_deux_sources + activites.dont_deux_sources + culture.dont_deux_sources + services.dont_deux_sources}
- Uniquement dans DATA Tourisme : ${hebergements.dont_data_tourisme + activites.dont_data_tourisme + culture.dont_data_tourisme + services.dont_data_tourisme}
- Uniquement dans SIRENE : ${hebergements.dont_sirene + activites.dont_sirene + culture.dont_sirene + services.dont_sirene}

Génère une analyse du stock physique de cette destination pour un rapport d'audit digital. Sois factuel et orienté business.

Réponds UNIQUEMENT avec ce JSON valide :
{
  "points_forts": ["point 1", "point 2"],
  "points_attention": ["point 1", "point 2"],
  "indicateurs_cles": [
    { "label": "Stock total", "valeur": "${total_stock_physique} établissements", "interpretation": "moyen" },
    { "label": "Taux couverture DATA Tourisme", "valeur": "${taux_couverture_dt}%", "interpretation": "moyen" },
    { "label": "Hébergements recensés", "valeur": "${hebergements.total_unique}", "interpretation": "fort" }
  ],
  "synthese_narrative": "80-120 mots pour rapport GDoc..."
}`

    const reponse = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Tu es expert en tourisme et transformation digitale des destinations françaises. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.',
          },
          { role: 'user', content: promptUser },
        ],
        temperature: 0.2,
        max_tokens: 600,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 45000,
      }
    )

    const brut = reponse.data.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())

    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
