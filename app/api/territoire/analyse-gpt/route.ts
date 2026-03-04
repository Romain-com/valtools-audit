// Route Handler — Analyse GPT du territoire
// Responsabilité : synthèse des données territoire via OpenAI (Responses API + web_search_preview)
// Identifie les "moteurs" de la sélection et valide via recherche en ligne

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

// URL Responses API OpenAI
const OPENAI_URL = 'https://api.openai.com/v1/responses'
const MODELE = 'gpt-5-mini'
const MAX_OUTPUT_TOKENS = 4000

// Extrait le texte d'une réponse Responses API quel que soit le format de l'output
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extraireTexte(data: any): string {
  if (!data?.output) return data?.choices?.[0]?.message?.content ?? ''
  // Parcourir tous les blocs — le type peut être 'message' ou 'text'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const bloc of data.output) {
    if (bloc.type === 'message' && Array.isArray(bloc.content)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const item of bloc.content) {
        if (typeof item.text === 'string' && item.text) return item.text
      }
    }
    // Certains modèles retournent directement un bloc de type 'text'
    if (bloc.type === 'text' && typeof bloc.text === 'string' && bloc.text) return bloc.text
  }
  return ''
}

// ─── Types d'entrée ───────────────────────────────────────────────────────────

interface ResultatTaxe {
  collecteur: 'commune' | 'epci' | 'non_institue'
  nom_collecteur: string
  montant_total: number
  montant_estime_commune: number | null
  annee: number
  nuitees_estimees: number
}

interface Etablissement {
  nom: string
  sous_categorie: string
  capacite?: number | null
}

interface ResultatCommune {
  commune: { nom: string; code_insee: string; code_departement: string }
  hebergements: Etablissement[]
  poi: Etablissement[]
  taxe: ResultatTaxe | null
  residences_secondaires: number | null
}

// ─── Construction du prompt ───────────────────────────────────────────────────

function construireResumeTerritoire(resultats: ResultatCommune[]): string {
  const lignes: string[] = []

  for (const r of resultats) {
    const nom = r.commune.nom
    const dept = r.commune.code_departement

    // Hébergements — comptage par sous-catégorie
    const hebParType: Record<string, number> = {}
    for (const h of r.hebergements) {
      hebParType[h.sous_categorie] = (hebParType[h.sous_categorie] ?? 0) + 1
    }
    const hebStr = Object.entries(hebParType)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${n} ${t}`)
      .join(', ') || 'aucun'

    // POI — comptage par catégorie
    const poiParCat: Record<string, number> = {}
    for (const p of r.poi) {
      poiParCat[p.sous_categorie] = (poiParCat[p.sous_categorie] ?? 0) + 1
    }
    const poiStr = Object.entries(poiParCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, n]) => `${n} ${t}`)
      .join(', ') || 'aucun'

    // Taxe de séjour
    let taxeStr = 'non instituée'
    if (r.taxe && r.taxe.collecteur !== 'non_institue') {
      const montant = r.taxe.montant_estime_commune ?? r.taxe.montant_total
      taxeStr = `${(montant / 1_000_000).toFixed(2)} M€ (${r.taxe.annee}, ${r.taxe.nuitees_estimees.toLocaleString('fr-FR')} nuitées estimées)`
    }

    // Résidences secondaires
    const rs = r.residences_secondaires !== null ? `${r.residences_secondaires.toLocaleString('fr-FR')} rés. secondaires` : 'rés. secondaires inconnues'

    lignes.push(`- ${nom} (Dép. ${dept}) : ${r.hebergements.length} hébergements (${hebStr}), ${r.poi.length} POI (${poiStr}), taxe séjour: ${taxeStr}, ${rs}`)
  }

  return lignes.join('\n')
}

// ─── Route POST ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { resultats } = await req.json() as { resultats: ResultatCommune[] }

    if (!resultats || resultats.length === 0) {
      return NextResponse.json({ error: 'Aucun résultat fourni' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY manquant' }, { status: 500 })
    }

    const nomsCommunes = resultats.map((r) => r.commune.nom).join(', ')
    const resumeDonnees = construireResumeTerritoire(resultats)

    // Prompt combiné instruction + données
    const prompt = `Tu es un expert en tourisme et développement territorial français.
Voici les données d'une sélection de ${resultats.length} communes touristiques :

${resumeDonnees}

Ta mission :
1. Identifie les 3 à 5 "communes moteurs" de cette sélection (celles qui concentrent le plus de capacité d'accueil, de diversité d'offre ou de revenus touristiques).
2. Identifie les spécialisations touristiques dominantes du territoire (ski, randonnée, thermalisme, gastronomie, patrimoine, etc.).
3. Donne un indicateur de maturité touristique globale du territoire (faible / intermédiaire / fort / très fort) avec justification courte.
4. Si certaines communes semblent sous-exploitées malgré un potentiel, signale-le.

Appuie-toi sur tes connaissances du tourisme français (stations de ski, lacs, sites classés, thermalismes, etc.) pour enrichir l'analyse, mais reste factuel et prudent : si tu n'es pas certain d'une information sur une commune spécifique, ne l'invente pas.

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires) :
{
  "communes_moteurs": [
    { "nom": "...", "raison": "..." }
  ],
  "specialisations": ["...", "..."],
  "maturite_touristique": {
    "niveau": "fort",
    "justification": "..."
  },
  "communes_sous_exploitees": [
    { "nom": "...", "potentiel": "..." }
  ],
  "synthese": "paragraphe de 80 à 120 mots résumant le profil touristique global du territoire, prêt à intégrer dans un rapport"
}`

    console.log(`[AnalyseGPT] Lancement analyse pour : ${nomsCommunes}`)

    const response = await axios.post(
      OPENAI_URL,
      {
        model: MODELE,
        input: prompt,
        max_output_tokens: MAX_OUTPUT_TOKENS,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      }
    )

    const contenuBrut = extraireTexte(response.data)
    console.log(`[AnalyseGPT] Réponse reçue, longueur : ${contenuBrut.length} chars`)

    if (!contenuBrut) {
      // Log la structure complète pour diagnostique
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const types = response.data?.output?.map((o: any) => `${o.type}(${o.content?.length ?? '-'})`) ?? []
      console.error('[AnalyseGPT] Réponse vide — blocs output :', types.join(', '))
      throw new Error('Réponse OpenAI vide — vérifier les logs serveur')
    }

    // Nettoyage + parsing JSON
    const contenuNettoye = contenuBrut.replace(/```json\n?|```/g, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(contenuNettoye)
    } catch (parseErr) {
      console.error('[AnalyseGPT] Erreur JSON.parse :', parseErr)
      console.error('[AnalyseGPT] Contenu brut (500 premiers chars) :', contenuNettoye.slice(0, 500))
      console.error('[AnalyseGPT] Contenu brut (500 derniers chars) :', contenuNettoye.slice(-500))
      throw new Error(`JSON invalide reçu d'OpenAI : ${parseErr instanceof Error ? parseErr.message : 'erreur inconnue'}`)
    }

    return NextResponse.json({ analyse: parsed })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[AnalyseGPT] Erreur :', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
