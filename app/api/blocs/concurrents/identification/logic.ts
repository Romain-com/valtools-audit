// Logique métier — concurrents/identification
// Identifie 5 destinations concurrentes via GPT-5-mini (Responses API) à partir du contexte complet de l'audit
// ⚠️ Serveur uniquement — aucune clé API exposée côté client

import axios from 'axios'
import { parseOpenAIResponse } from '@/lib/openai-parse'
import type { ContexteAuditPourConcurrents, ConcurrentIdentifie } from '@/types/concurrents'

// URL de l'API OpenAI — Responses API
const OPENAI_URL = 'https://api.openai.com/v1/responses'

/**
 * Identifie 6 concurrents via OpenAI, filtre les sous-destinations et retourne au max 5.
 * @param contexte     - Données d'audit de la destination cible
 * @param destination  - Nom de la destination cible
 */
export async function executerIdentificationConcurrents({
  contexte,
  destination,
}: {
  contexte: ContexteAuditPourConcurrents
  destination: string
}): Promise<{ concurrents: ConcurrentIdentifie[]; analyse_paysage: string }> {
  if (!contexte || !destination) {
    throw new Error('contexte et destination requis')
  }

  const { positionnement, volume_affaires, visibilite_seo } = contexte
  const nuitees = volume_affaires.nuitees_estimees.toLocaleString('fr-FR')
  const top3 = visibilite_seo.top_3_keywords.join(', ')

  const promptUser = `Tu es expert en tourisme et stratégie digitale des destinations françaises. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.

En analysant ces données d'audit, identifie les 6 destinations françaises les plus pertinentes à comparer avec ${destination} (6 pour avoir un choix après filtrage).

Critères de sélection à appliquer simultanément :
1. GÉOGRAPHIQUE : même région ou bassin touristique (Alpes, Côte d'Azur, Bretagne...)
2. TAILLE : ordre de grandeur similaire de nuitées (${nuitees} nuitées/an)
3. POSITIONNEMENT : même type de destination (${positionnement.type_destination})
4. SEO : destinations qui apparaissent probablement sur les mêmes mots-clés (${top3})

Données de la destination à comparer :
${JSON.stringify(contexte, null, 2)}

⚠️ EXCLUSIONS ABSOLUES — Ne jamais proposer :
- Un quartier, une commune-associée ou une subdivision administrative de ${destination} (ex : si destination = "Annecy", exclure "Annecy-le-Vieux", "Annecy-le-Lac", etc.)
- Une destination dont le nom commence par "${destination}" ou le contient comme préfixe
- La destination cible elle-même sous un autre nom

Pour chaque concurrent, trouve également le domaine de son site OT officiel (ex: "ot-chamonix.com", "lac-bourget-tourisme.fr").
Si tu n'es pas sûr du domaine, indique ton meilleur estimé avec confiance "incertain".

Retourne UNIQUEMENT un JSON valide :
{
  "concurrents": [
    {
      "nom": "string",
      "code_insee": "string",
      "departement": "string",
      "type_destination": "string",
      "raison_selection": "string",
      "domaine_ot": "string",
      "confiance_domaine": "certain",
      "domaine_valide": "string"
    }
  ],
  "analyse_paysage": "string"
}`

  const reponse = await axios.post(
    OPENAI_URL,
    {
      model: 'gpt-5-mini',
      input: promptUser,
      max_output_tokens: 2000,
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
  const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())

  // Normalisation pour la comparaison (sans accents, minuscules)
  const normaliser = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

  const destinationNorm = normaliser(destination)

  // Filtre dur : exclure tout concurrent dont le nom normalisé commence par la destination
  // (couvre "Annecy-le-Vieux", "Annecy-le-Lac", "Paris 15e" si destination="Paris", etc.)
  const concurrents = (parsed.concurrents as ConcurrentIdentifie[])
    .filter((c) => {
      const nomNorm = normaliser(c.nom)
      const estSousDestination =
        nomNorm.startsWith(destinationNorm + '-') ||
        nomNorm.startsWith(destinationNorm + ' ') ||
        nomNorm === destinationNorm
      if (estSousDestination) {
        console.warn(`[Identification] Concurrent exclu (subdivision) : ${c.nom}`)
      }
      return !estSousDestination
    })
    .slice(0, 5) // garder au maximum 5 concurrents après filtrage
    .map((c) => ({
      ...c,
      domaine_valide: c.domaine_valide || c.domaine_ot,
    }))

  return {
    concurrents,
    analyse_paysage: parsed.analyse_paysage ?? '',
  }
}
