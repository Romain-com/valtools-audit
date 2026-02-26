// Logique métier — stocks-physiques/synthese
// Génère via GPT-5-mini (Responses API) la synthèse narrative des stocks physiques
// Input : stocks finaux fusionnés (DATA Tourisme + SIRENE)

import axios from 'axios'
import { parseOpenAIResponse } from '@/lib/openai-parse'
import type { StocksPhysiquesFinaux } from '@/types/stocks-physiques'

// URL de l'API OpenAI — Responses API
const OPENAI_URL = 'https://api.openai.com/v1/responses'

/**
 * Génère la synthèse narrative des stocks physiques via OpenAI.
 * @param destination - Nom de la destination
 * @param stocks      - Stocks physiques finaux fusionnés (Bloc 5)
 */
export async function executerSyntheseStocksPhysiques({
  destination,
  stocks,
}: {
  destination: string
  stocks: StocksPhysiquesFinaux
}): Promise<unknown> {
  if (!destination || !stocks) {
    throw new Error('destination et stocks requis')
  }

  const { hebergements, activites, culture, services, total_stock_physique, couverture, ratio_particuliers_hebergement } =
    stocks

  // Helper pour formater une ligne détail
  const fmt = (label: string, v: { volume: number; pct: number }) =>
    `${label}: ${v.volume} (${v.pct}%)`

  const promptUser = `Tu es expert en tourisme et transformation digitale des destinations françaises. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.

Destination touristique : ${destination}

Stock physique total recensé : ${total_stock_physique} établissements

HÉBERGEMENTS (${hebergements.total_unique} uniques — couverture DATA Tourisme : ${couverture.hebergements}%) :
- ${fmt('Hôtels', hebergements.detail.hotels)}
- ${fmt('Meublés/locations saisonnières', hebergements.detail.meubles_locations)}
- ${fmt('Campings', hebergements.detail.campings)}
- ${fmt('Hébergements collectifs', hebergements.detail.collectifs)}
- ${fmt('Autres hébergements', hebergements.detail.autres)}
- Dont particuliers (meublés NAF 55.20Z) : ${ratio_particuliers_hebergement}% du stock SIRENE

ACTIVITÉS (${activites.total_unique} uniques — couverture DATA Tourisme : ${couverture.activites}%) :
- ${fmt('Sports & loisirs', activites.detail.sports_loisirs)}
- ${fmt('Visites & circuits', activites.detail.visites_tours)}
- ${fmt('Expériences & attractions', activites.detail.experiences)}
- ${fmt('Agences réceptives & activités', activites.detail.agences_activites)}

CULTURE & PATRIMOINE (${culture.total_unique} uniques — couverture DATA Tourisme : ${couverture.culture}%) :
- ${fmt('Patrimoine (châteaux, monuments, sites)', culture.detail.patrimoine)}
- ${fmt('Sites religieux', culture.detail.religieux)}
- ${fmt('Musées & galeries', culture.detail.musees_galeries)}
- ${fmt('Spectacle vivant (théâtres, cinémas)', culture.detail.spectacle_vivant)}
- ${fmt('Nature & jardins', culture.detail.nature)}

SERVICES TOURISTIQUES (${services.total_unique} uniques) :
- ${fmt('Offices de tourisme', services.detail.offices_tourisme)}
- ${fmt('Agences de voyage', services.detail.agences_voyage)}
- ${fmt('Location matériel', services.detail.location_materiel)}
- ${fmt('Transport', services.detail.transport)}

Recoupement sources :
- Dans les deux sources (DATA Tourisme + SIRENE) : ${hebergements.dont_deux_sources + activites.dont_deux_sources + culture.dont_deux_sources + services.dont_deux_sources}
- Uniquement dans DATA Tourisme : ${hebergements.dont_data_tourisme + activites.dont_data_tourisme + culture.dont_data_tourisme + services.dont_data_tourisme}
- Uniquement dans SIRENE : ${hebergements.dont_sirene + activites.dont_sirene + culture.dont_sirene + services.dont_sirene}
- Couverture DATA Tourisme globale : ${couverture.global}%

Génère une analyse du stock physique de cette destination pour un rapport d'audit digital. Sois factuel et orienté business. Interprète notamment le ratio particuliers et la couverture DATA Tourisme.

Réponds UNIQUEMENT avec ce JSON valide :
{
  "points_forts": ["point 1", "point 2"],
  "points_attention": ["point 1", "point 2"],
  "indicateurs_cles": [
    { "label": "Stock total", "valeur": "${total_stock_physique} établissements", "interpretation": "moyen" },
    { "label": "Couverture DATA Tourisme", "valeur": "${couverture.global}%", "interpretation": "moyen" },
    { "label": "Ratio meublés particuliers", "valeur": "${ratio_particuliers_hebergement}%", "interpretation": "moyen" }
  ],
  "synthese_narrative": "80-120 mots pour rapport GDoc..."
}`

  const reponse = await axios.post(
    OPENAI_URL,
    {
      model: 'gpt-5-mini',
      input: promptUser,
      max_output_tokens: 1000,
      reasoning: { effort: 'low' },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 180_000,
    }
  )

  const brut = parseOpenAIResponse(reponse.data)
  return JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
}
