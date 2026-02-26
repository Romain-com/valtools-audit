// Logique métier — génération OpenAI pour le Bloc 2 Volume d'affaires
// Génère via GPT-4o-mini : synthèse volume d'affaires + 3 indicateurs clés
// Si EPCI : estime aussi la part de la commune dans le total intercommunal
// Extrait de route.ts pour permettre l'import direct depuis l'orchestrateur (évite les appels auto-référentiels)

import axios from 'axios'
import type { DonneesCollecteur } from '@/types/volume-affaires'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

/**
 * Génère la synthèse volume d'affaires et les indicateurs clés via OpenAI.
 * Si le collecteur est un EPCI, estime aussi la part de la commune cible.
 */
export async function executerOpenAIVolumeAffaires({
  destination,
  collecteur,
  est_epci,
  population_commune,
}: {
  destination: string
  collecteur: DonneesCollecteur
  est_epci: boolean
  population_commune?: number
}): Promise<{
  synthese_volume?: string
  indicateurs_cles?: string[]
  part_commune?: {
    pourcentage: number
    montant_euros: number
    raisonnement: string
  }
}> {
  if (!destination || !collecteur) {
    throw new Error('destination et collecteur requis')
  }

  const montantFormate = collecteur.montant_taxe_euros.toLocaleString('fr-FR')
  const nuiteesFormatees = collecteur.nuitees_estimees.toLocaleString('fr-FR')

  // Prompt différent selon que la taxe est collectée par la commune ou l'EPCI
  let promptUser: string

  if (est_epci) {
    promptUser = `Destination auditée : ${destination}
La taxe de séjour est collectée par ${collecteur.nom} (${collecteur.type_epci}).
Montant total EPCI : ${montantFormate}€ en ${collecteur.annee_donnees}.
Nuitées estimées EPCI (taux moyen national 1,50€/nuit) : ${nuiteesFormatees}.

Estime la part de la commune ${destination} dans ce total EPCI selon son poids touristique (notoriété, taille, équipements).

Génère aussi une synthèse volume (80-100 mots pour rapport GDoc) et 3 indicateurs clés chiffrés.

Réponds avec ce JSON exact :
{
  "part_commune": {
    "pourcentage": 35,
    "montant_euros": 125000,
    "raisonnement": "2-3 phrases expliquant l'estimation"
  },
  "synthese_volume": "80-100 mots...",
  "indicateurs_cles": ["chiffre 1", "chiffre 2", "chiffre 3"]
}`
  } else {
    promptUser = `Destination : ${destination}
Montant taxe de séjour collectée : ${montantFormate}€ en ${collecteur.annee_donnees}.
Nuitées estimées (taux moyen national 1,50€/nuit) : ${nuiteesFormatees}.

Génère une synthèse volume (80-100 mots pour rapport GDoc) et 3 indicateurs clés chiffrés.

Réponds avec ce JSON exact :
{
  "synthese_volume": "80-100 mots...",
  "indicateurs_cles": ["chiffre 1", "chiffre 2", "chiffre 3"]
}`
  }

  const reponse = await axios.post(
    OPENAI_URL,
    {
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content:
            'Tu es expert en finances locales françaises et tourisme. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.',
        },
        { role: 'user', content: promptUser },
      ],
      temperature: 0.2,
      max_tokens: 500,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  )

  const brut = reponse.data.choices?.[0]?.message?.content ?? ''
  const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())

  return parsed
}
