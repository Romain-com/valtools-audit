// Logique métier — stock-en-ligne/synthese
// Génère via GPT-5-mini (Responses API) la synthèse de la commercialisation en ligne (Bloc 6)
// Input : données brutes des 4 sources + indicateurs calculés

import axios from 'axios'
import { parseOpenAIResponse } from '@/lib/openai-parse'
import type {
  ResultatSiteOT,
  ResultatAirbnb,
  ResultatBooking,
  ResultatViator,
  IndicateursBloc6,
  SyntheseBloc6,
} from '@/types/stock-en-ligne'

// URL de l'API OpenAI — Responses API
const OPENAI_URL = 'https://api.openai.com/v1/responses'

/**
 * Génère la synthèse de la commercialisation en ligne via OpenAI.
 */
export async function executerSyntheseStockEnLigne({
  destination,
  domaine_ot,
  ot,
  airbnb,
  booking,
  viator,
  indicateurs,
}: {
  destination: string
  domaine_ot: string
  ot: ResultatSiteOT | null
  airbnb: ResultatAirbnb | null
  booking: ResultatBooking | null
  viator: ResultatViator | null
  indicateurs: IndicateursBloc6
}): Promise<SyntheseBloc6 & { cout: { nb_appels: number; cout_unitaire: number; cout_total: number } }> {
  if (!destination || !indicateurs) {
    throw new Error('destination et indicateurs requis')
  }

  const formatPct = (v: number | null): string =>
    v !== null ? `${v}%` : 'N/A (données bloc 5 manquantes)'

  const promptUser = `Tu es expert en tourisme digital français. Analyse les données de commercialisation en ligne de cette destination. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.

Destination : ${destination}
Site OT : ${domaine_ot}

SITE OT (${domaine_ot}) :
- Hébergements : ${ot?.hebergements.nb_fiches ?? 0} fiches (type: ${ot?.hebergements.type ?? 'absent'})
- Activités : ${ot?.activites.nb_fiches ?? 0} fiches (type: ${ot?.activites.type ?? 'absent'})
- OTA détectées sur le site OT : ${indicateurs.site_ot_ota_detectees.join(', ') || 'aucune'}
- Moteur de réservation : ${indicateurs.moteur_resa_detecte ?? 'non détecté'}

STOCK EN LIGNE SUR LES OTA :
- Airbnb : ${airbnb?.total_annonces ?? 'N/A'} annonces hébergement
- Booking.com : ${booking?.total_proprietes ?? 'N/A'} propriétés (hôtels: ${booking?.detail.hotels ?? 'N/A'}, apparts: ${booking?.detail.apparts ?? 'N/A'}, campings: ${booking?.detail.campings ?? 'N/A'})
- Viator : ${viator?.total_activites ?? 'N/A'} activités/expériences
- Total hébergements OTA (Airbnb + Booking) : ${indicateurs.total_ota_hebergements}

INDICATEURS DE CROISEMENT (vs stock physique Bloc 5) :
- Taux de dépendance OTA : ${formatPct(indicateurs.taux_dependance_ota)} — part du stock physique commercialisée via les OTA
- Taux réservable direct OT : ${formatPct(indicateurs.taux_reservable_direct)} — part du stock OTA réservable via le site OT
- Taux visibilité Viator : ${formatPct(indicateurs.taux_visibilite_activites)} — part du stock d'activités visible sur Viator

Génère une analyse orientée business pour un rapport d'audit digital. Message clé : "Votre territoire se vend en ligne — mais via les OTA, pas via vous."

Réponds UNIQUEMENT avec ce JSON valide (sans markdown) :
{
  "diagnostic": "court paragraphe de diagnostic (2-3 phrases, factuel et percutant)",
  "points_cles": [
    { "label": "Dépendance OTA", "valeur": "${formatPct(indicateurs.taux_dependance_ota)}", "niveau": "bon|moyen|critique" },
    { "label": "Réservation directe OT", "valeur": "${formatPct(indicateurs.taux_reservable_direct)}", "niveau": "bon|moyen|critique" },
    { "label": "Activités sur Viator", "valeur": "${formatPct(indicateurs.taux_visibilite_activites)}", "niveau": "bon|moyen|critique" }
  ],
  "message_ot": "message percutant à destination de l'OT (1 phrase choc)",
  "recommandations": ["recommandation 1", "recommandation 2", "recommandation 3"]
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
  const parsed: SyntheseBloc6 = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())

  return {
    ...parsed,
    cout: { nb_appels: 1, cout_unitaire: 0.001, cout_total: 0.001 },
  }
}
