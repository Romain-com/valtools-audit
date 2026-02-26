// Logique métier — OpenAI GPT-5-mini (Responses API)
// Responsabilité : analyser les données Google + Instagram et produire un positionnement marketing
// Importé directement par l'orchestrateur pour éviter les appels HTTP auto-référentiels

import axios from 'axios'
import { parseOpenAIResponse } from '@/lib/openai-parse'
import type {
  ResultatMaps,
  ResultatInstagram,
  AnalysePositionnement,
  AnalysePositionnementErreur,
} from '@/types/positionnement'

// URL de l'API OpenAI — Responses API
const OPENAI_URL = 'https://api.openai.com/v1/responses'

// Paramètres du modèle
const MODELE = 'gpt-5-mini'
const MAX_OUTPUT_TOKENS = 1000

// Coût unitaire par appel (en euros)
const COUT_UNITAIRE = 0.001

/**
 * Construit le prompt utilisateur à partir des données Google Maps et Instagram.
 * OpenAI reçoit les données brutes — il n'effectue aucune recherche par lui-même.
 */
function construirePromptUtilisateur(
  destination: string,
  google: ResultatMaps,
  instagram: ResultatInstagram
): string {
  const ficheOT = 'absent' in google.ot
    ? 'Aucune fiche OT trouvée sur Google Maps.'
    : `Note OT : ${google.ot.note}/5 (${google.ot.avis} avis) — ${google.ot.nom}`

  const resumeInstagram = instagram.posts_count
    ? `${instagram.posts_count.toLocaleString('fr-FR')} posts pour #${instagram.hashtag}, ${instagram.posts_recents.length} posts récents analysés, ratio OT/UGC : ${instagram.ratio_ot_ugc}`
    : `Données Instagram partielles pour #${instagram.hashtag}`

  const exemplesPostsRecents = instagram.posts_recents
    .slice(0, 5)
    .map((p, i) => `  ${i + 1}. @${p.username} (${p.likes} likes) : "${p.caption?.slice(0, 80) ?? ''}"`)
    .join('\n')

  // Résumé des POI notés (on exclut les fiches absentes)
  const poiNotes = (google.poi ?? [])
    .filter((f): f is import('@/types/positionnement').FicheGoogle => !('absent' in f) && f.note > 0)
    .map((f) => `${f.nom} : ${f.note}/5 (${f.avis} avis)`)
    .join(', ')

  return `Destination touristique : ${destination}

DONNÉES GOOGLE MAPS :
- ${ficheOT}
${poiNotes ? `- POI phares : ${poiNotes}` : ''}
- Score de synthèse : ${google.score_synthese}/5

DONNÉES INSTAGRAM :
- ${resumeInstagram}
${exemplesPostsRecents ? `\nExemples de posts récents :\n${exemplesPostsRecents}` : ''}

Sur la base de ces données, génère l'analyse marketing suivante en JSON valide :
{
  "axe_principal": "une phrase résumant le positionnement perçu de la destination",
  "mots_cles": ["mot1", "mot2", "mot3"],
  "forces_faiblesses": {
    "forces": ["force 1", "force 2"],
    "faiblesses": ["faiblesse 1", "faiblesse 2"]
  },
  "paragraphe_gdoc": "paragraphe rédigé de 80 à 100 mots, prêt à coller dans un rapport Google Docs, en français"
}`
}

/**
 * Appelle OpenAI pour analyser les données de positionnement d'une destination.
 * En cas d'erreur API ou de parsing échoué, retourne un objet AnalysePositionnementErreur.
 */
export async function executerOpenAIPositionnement({
  destination,
  google,
  instagram,
}: {
  destination: string
  google: ResultatMaps
  instagram: ResultatInstagram
}): Promise<AnalysePositionnement | AnalysePositionnementErreur> {
  if (!destination || !google || !instagram) {
    throw new Error('Paramètres manquants : destination, google, instagram requis')
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Variable OPENAI_API_KEY manquante')
  }

  // ─── Appel OpenAI ────────────────────────────────────────────────────────

  let contenuBrut = ''

  // Log diagnostique — payload envoyé à OpenAI
  const promptUser = construirePromptUtilisateur(destination, google, instagram)
  console.log('[OpenAI Bloc1] prompt length:', promptUser.length, '| google.ot:', JSON.stringify(google?.ot)?.slice(0, 100))

  // Combinaison instruction système + prompt utilisateur pour la Responses API
  const inputCombine = `Tu es un expert en marketing touristique français. Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires).\n\n${promptUser}`

  try {
    const response = await axios.post(
      OPENAI_URL,
      {
        model: MODELE,
        input: inputCombine,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: 'low' },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 180_000,
      }
    )

    contenuBrut = parseOpenAIResponse(response.data)
  } catch (err: unknown) {
    // Log du message d'erreur OpenAI pour diagnostique
    const axiosErr = err as { response?: { data?: unknown }; message?: string; status?: number; code?: string }
    console.error('[OpenAI] Erreur appel API :', err)
    console.error('[OpenAI] Réponse serveur :', JSON.stringify(axiosErr.response?.data))
    const resultatErreur: AnalysePositionnementErreur = {
      erreur: 'parsing_failed',
      raw: '',
      cout: { nb_appels: 1, cout_unitaire: COUT_UNITAIRE, cout_total: COUT_UNITAIRE },
    }
    return resultatErreur
  }

  // ─── Parsing du JSON — avec nettoyage des blocs markdown éventuels ───────
  // OpenAI peut parfois envelopper la réponse dans des balises ```json```
  try {
    const contenuNettoye = contenuBrut.replace(/```json\n?|```/g, '').trim()
    const parsed = JSON.parse(contenuNettoye)

    const resultat: AnalysePositionnement = {
      axe_principal: parsed.axe_principal ?? '',
      mots_cles: parsed.mots_cles ?? [],
      forces_faiblesses: {
        forces: parsed.forces_faiblesses?.forces ?? [],
        faiblesses: parsed.forces_faiblesses?.faiblesses ?? [],
      },
      paragraphe_gdoc: parsed.paragraphe_gdoc ?? '',
      cout: {
        nb_appels: 1,
        cout_unitaire: COUT_UNITAIRE,
        cout_total: COUT_UNITAIRE,
      },
    }

    return resultat
  } catch {
    // Fallback : parsing échoué — on retourne le contenu brut pour débogage
    const resultatErreur: AnalysePositionnementErreur = {
      erreur: 'parsing_failed',
      raw: contenuBrut,
      cout: { nb_appels: 1, cout_unitaire: COUT_UNITAIRE, cout_total: COUT_UNITAIRE },
    }
    return resultatErreur
  }
}
