// Route Handler — Classification OpenAI des résultats SERP
// Responsabilité : identifier la catégorie de chaque site (officiel_ot, ota, media...)
//   extraire les 3 premiers sites officiels, le domaine OT principal,
//   et calculer la visibilité OT par intention de recherche
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { CategorieResultatSERP, SiteOfficiel, VisibiliteParIntention } from '@/types/schema-digital'

// URL de l'API OpenAI
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

// ─── Types internes ───────────────────────────────────────────────────────────

interface ItemSERP {
  position: number
  url: string
  domaine: string
  titre: string
  meta_description: string
  requete_source: string
}

interface RequeteTop3 {
  requete: string
  keyword: string
  top3: ItemSERP[]
}

interface ResultatClassification {
  domaine: string
  categorie: CategorieResultatSERP
  titre: string
  meta_description: string
  position?: number
  url?: string
  requete_source?: string
}

interface ReponseOpenAI {
  resultats_classes: ResultatClassification[]
  top3_officiels: SiteOfficiel[]
  domaine_ot: string | null
  visibilite_ot_par_intention: Record<string, VisibiliteParIntention>
  score_visibilite_ot: number
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { destination, tous_resultats, par_requete } = body as {
    destination?: string
    tous_resultats?: ItemSERP[]
    par_requete?: RequeteTop3[]
  }

  if (!destination || !tous_resultats?.length) {
    return NextResponse.json(
      { erreur: 'Paramètres destination et tous_resultats requis' },
      { status: 400 }
    )
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ erreur: 'Variable OPENAI_API_KEY manquante' }, { status: 500 })
  }

  // Tronquer les champs pour réduire la taille du prompt et éviter le dépassement de max_tokens
  const resumeTous = tous_resultats.map((r) => ({
    domaine: r.domaine,
    titre: r.titre.slice(0, 80),
    meta_description: r.meta_description.slice(0, 100),
  }))

  // Résumé compact des top 3 par intention : "keyword" : 1. domaine | 2. domaine | 3. domaine
  const resumeParIntention = (par_requete ?? [])
    .map((r) => {
      const ligne = r.top3.map((item, i) => `${i + 1}. ${item.domaine}`).join(' | ')
      return `"${r.keyword}" : ${ligne || '(aucun résultat)'}`
    })
    .join('\n')

  const promptUtilisateur = `Destination auditée : ${destination}

RÉSULTATS PAR INTENTION DE RECHERCHE (top 3 par requête) :
${resumeParIntention}

TOUS LES DOMAINES À CLASSIFIER :
${JSON.stringify(resumeTous, null, 2)}

Catégories :
- officiel_ot : site de l'office de tourisme de la destination
- officiel_mairie : site de la mairie ou de la collectivité territoriale
- officiel_autre : CDT, région, autre institutionnel lié à la destination
- ota : plateformes de réservation (Booking, TripAdvisor, Airbnb, Expedia, Gîtes de France...)
- media : presse, blogs, guides (Routard, Petit Futé, Lonely Planet...)
- autre : tout le reste

Réponds avec ce JSON exact :
{
  "resultats_classes": [
    { "domaine": "lac-annecy.com", "categorie": "officiel_ot", "titre": "...", "meta_description": "..." }
  ],
  "top3_officiels": [
    { "domaine": "lac-annecy.com", "categorie": "officiel_ot", "titre": "...", "meta_description": "...", "position_serp": 1 }
  ],
  "domaine_ot": "lac-annecy.com",
  "visibilite_ot_par_intention": {
    "destination":  { "position": 1, "categorie_pos1": "officiel_ot" },
    "tourisme":     { "position": 1, "categorie_pos1": "officiel_ot" },
    "hebergement":  { "position": null, "categorie_pos1": "ota" },
    "que_faire":    { "position": null, "categorie_pos1": "media" },
    "restaurant":   { "position": null, "categorie_pos1": "ota" }
  },
  "score_visibilite_ot": 2
}

⚠️ score_visibilite_ot = nombre d'intentions où un site officiel_ est EN POSITION 1 (0 à 5)
⚠️ visibilite_ot_par_intention.position = position du premier site officiel_ dans cette requête (null si absent du top 3)
⚠️ visibilite_ot_par_intention.categorie_pos1 = catégorie du site qui est réellement en position 1 de cette requête
⚠️ top3_officiels = uniquement les résultats dont la catégorie commence par "officiel_"`

  try {
    const response = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Tu es expert en marketing digital touristique français. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.',
          },
          { role: 'user', content: promptUtilisateur },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      }
    )

    const brut = response.data.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim()) as ReponseOpenAI

    // Refiltre de sécurité — top3_officiels doit commencer par "officiel_"
    const top3_officiels = (parsed.top3_officiels ?? []).filter((s) =>
      s.categorie?.startsWith('officiel_')
    )

    const domaine_ot = parsed.domaine_ot ?? null

    // Enrichir les résultats classés avec position, url et requete_source depuis le SERP original
    const resultats_enrichis = (parsed.resultats_classes ?? []).map((r) => {
      const original = tous_resultats.find((s) => s.domaine === r.domaine)
      return {
        ...r,
        position: original?.position ?? 0,
        url: original?.url ?? '',
        requete_source: original?.requete_source ?? 'destination',
      }
    })

    return NextResponse.json({
      resultats_classes: resultats_enrichis,
      top3_officiels,
      domaine_ot,
      visibilite_ot_par_intention: parsed.visibilite_ot_par_intention ?? {},
      score_visibilite_ot: parsed.score_visibilite_ot ?? 0,
    })
  } catch (err) {
    console.error('[Classification] Erreur OpenAI :', err)
    return NextResponse.json({
      resultats_classes: [],
      top3_officiels: [],
      domaine_ot: null,
      visibilite_ot_par_intention: {},
      score_visibilite_ot: 0,
      erreur: err instanceof Error ? err.message : 'Erreur inconnue',
    })
  }
}
