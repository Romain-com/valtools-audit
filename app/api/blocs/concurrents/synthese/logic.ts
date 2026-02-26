// Logique métier — concurrents/synthese
// Génère la synthèse comparative via GPT-5-mini (Responses API)
// Input : tableau comparatif destination cible vs concurrents validés
// ⚠️ Serveur uniquement — aucune clé API exposée côté client

import axios from 'axios'
import { parseOpenAIResponse } from '@/lib/openai-parse'
import type { TableauComparatif } from '@/types/concurrents'

// URL de l'API OpenAI — Responses API
const OPENAI_URL = 'https://api.openai.com/v1/responses'

/**
 * Génère la synthèse comparative benchmarking via OpenAI.
 * @param destination          - Nom de la destination cible
 * @param tableau_comparatif   - Tableau comparatif avec métriques cible + concurrents
 * @param insight_gap          - Keywords non couverts vs concurrents (Haloscan siteCompetitors)
 */
export async function executerSyntheseConcurrents({
  destination,
  tableau_comparatif,
  insight_gap,
}: {
  destination: string
  tableau_comparatif: TableauComparatif
  insight_gap?: string
}): Promise<unknown> {
  if (!destination || !tableau_comparatif) {
    throw new Error('destination et tableau_comparatif requis')
  }

  const { destination_cible, concurrents } = tableau_comparatif

  // Formatage des concurrents pour le prompt
  const concurrentsStr = concurrents
    .map((c) => {
      const note = c.note_google ? `${c.note_google}/5 (${c.nb_avis_google ?? '?'} avis)` : 'non disponible'
      const pos = c.position_serp_requete_principale
        ? `position ${c.position_serp_requete_principale}`
        : 'absent SERP'
      return `- ${c.nom} : ${c.total_keywords.toLocaleString('fr-FR')} keywords, ${c.total_traffic.toLocaleString('fr-FR')} visites/mois, note Google ${note}, ${pos}`
    })
    .join('\n')

  // Section insight_gap uniquement si des données sont disponibles (> 1000 kw manquants)
  const sectionInsightGap = insight_gap
    ? `\nKEYWORDS MANQUANTS vs CONCURRENTS (source Haloscan siteCompetitors) :\n${insight_gap}\n`
    : ''

  const promptUser = `Tu es expert en tourisme et stratégie digitale des destinations françaises. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.

Analyse le positionnement de ${destination} face à ses concurrents.

DESTINATION CIBLE : ${destination}
- Keywords SEO : ${destination_cible.total_keywords.toLocaleString('fr-FR')}
- Trafic estimé : ${destination_cible.total_traffic.toLocaleString('fr-FR')} visites/mois
- Note Google : ${destination_cible.note_google}/5 (${destination_cible.nb_avis_google} avis)
- Score visibilité OT : ${destination_cible.score_visibilite_ot}/5
- Taux dépendance OTA : ${destination_cible.taux_dependance_ota.toFixed(1)}x (nb annonces OTA / nb hébergements physiques)
- Nuitées estimées : ${destination_cible.nuitees_estimees.toLocaleString('fr-FR')}/an

CONCURRENTS :
${concurrentsStr}${sectionInsightGap}

Retourne UNIQUEMENT un JSON valide (max 3 points_forts et 3 points_faibles) :
{
  "position_globale": "leader",
  "resume": "2-3 phrases synthétiques sur le positionnement digital de ${destination} face à ses concurrents",
  "points_forts": [
    { "critere": "string", "valeur": "string", "benchmark": "string" }
  ],
  "points_faibles": [
    { "critere": "string", "valeur": "string", "benchmark": "string" }
  ],
  "opportunite_cle": "1 phrase : la principale opportunité vs les concurrents",
  "message_ot": "1 phrase percutante destinée à l'Office de Tourisme"
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
