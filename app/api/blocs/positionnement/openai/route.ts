// Route Handler — OpenAI GPT-4o-mini
// Responsabilité : analyser les données Google + Instagram et produire un positionnement marketing
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type {
  ResultatMaps,
  ResultatInstagram,
  AnalysePositionnement,
  AnalysePositionnementErreur,
} from '@/types/positionnement'

// URL de l'API OpenAI
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

// Paramètres du modèle
const MODELE = 'gpt-4o-mini'
const TEMPERATURE = 0.2
const MAX_TOKENS = 400

// Coût unitaire par appel (en euros)
const COUT_UNITAIRE = 0.001

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

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

export async function POST(request: NextRequest) {
  // Lecture du body
  const body = await request.json().catch(() => ({}))
  const { destination, google, instagram } = body as {
    destination?: string
    google?: ResultatMaps
    instagram?: ResultatInstagram
  }

  if (!destination || !google || !instagram) {
    return NextResponse.json(
      { erreur: 'Paramètres manquants : destination, google, instagram requis' },
      { status: 400 }
    )
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json({ erreur: 'Variable OPENAI_API_KEY manquante' }, { status: 500 })
  }

  // ─── Appel OpenAI ────────────────────────────────────────────────────────

  const messages: OpenAIMessage[] = [
    {
      role: 'system',
      // Instruction stricte : JSON uniquement, pas de markdown
      content:
        "Tu es un expert en marketing touristique français. Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires).",
    },
    {
      role: 'user',
      content: construirePromptUtilisateur(destination, google, instagram),
    },
  ]

  let contenuBrut = ''

  try {
    const response = await axios.post<OpenAIResponse>(
      OPENAI_URL,
      {
        model: MODELE,
        messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        // Timeout raisonnable pour gpt-4o-mini
        timeout: 30_000,
      }
    )

    contenuBrut = response.data.choices?.[0]?.message?.content ?? ''
  } catch (err) {
    console.error('[OpenAI] Erreur appel API :', err)
    const resultatErreur: AnalysePositionnementErreur = {
      erreur: 'parsing_failed',
      raw: '',
      cout: { nb_appels: 1, cout_unitaire: COUT_UNITAIRE, cout_total: COUT_UNITAIRE },
    }
    return NextResponse.json(resultatErreur)
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

    return NextResponse.json(resultat)
  } catch {
    // Fallback : parsing échoué — on retourne le contenu brut pour débogage
    const resultatErreur: AnalysePositionnementErreur = {
      erreur: 'parsing_failed',
      raw: contenuBrut,
      cout: { nb_appels: 1, cout_unitaire: COUT_UNITAIRE, cout_total: COUT_UNITAIRE },
    }
    return NextResponse.json(resultatErreur)
  }
}
