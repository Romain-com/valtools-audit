// Route Handler — /api/blocs/stock-en-ligne/synthese
// Génère via GPT-4o-mini la synthèse de la commercialisation en ligne (Bloc 6)
// Input : données brutes des 4 sources + indicateurs calculés

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type {
  ResultatSiteOT,
  ResultatAirbnb,
  ResultatBooking,
  ResultatViator,
  IndicateursBloc6,
  SyntheseBloc6,
} from '@/types/stock-en-ligne'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

export async function POST(req: NextRequest) {
  try {
    const {
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
    } = await req.json()

    if (!destination || !indicateurs) {
      return NextResponse.json({ error: 'destination et indicateurs requis' }, { status: 400 })
    }

    const formatPct = (v: number | null): string =>
      v !== null ? `${v}%` : 'N/A (données bloc 5 manquantes)'

    const promptUser = `Tu es expert en tourisme digital français. Analyse les données de commercialisation en ligne de cette destination.

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
    const parsed: SyntheseBloc6 = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())

    return NextResponse.json({
      ...parsed,
      cout: { nb_appels: 1, cout_unitaire: 0.001, cout_total: 0.001 },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
