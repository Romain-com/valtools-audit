// Route Handler — Sélection IA des POI représentatifs
// Responsabilité : demander à OpenAI de choisir les 3 POI les plus pertinents parmi la liste brute
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { POIBrut, POISelectionne } from '@/types/positionnement'

// URL de l'API OpenAI
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

interface ReponsePoiSelection {
  poi_selectionnes: POISelectionne[]
  erreur?: string
  cout?: object
}

interface OpenAIResponse {
  choices?: Array<{
    message?: { content?: string }
  }>
}

export async function POST(request: NextRequest) {
  // Lecture du body
  const body = await request.json().catch(() => ({}))
  const { destination, poi_list } = body as {
    destination?: string
    poi_list?: POIBrut[]
  }

  if (!destination) {
    return NextResponse.json({ erreur: 'Paramètre destination manquant' }, { status: 400 })
  }

  // Cas : liste vide — pas d'appel OpenAI, on retourne immédiatement
  if (!poi_list || poi_list.length === 0) {
    const resultat: ReponsePoiSelection = {
      poi_selectionnes: [],
      erreur: 'liste_vide',
    }
    return NextResponse.json(resultat)
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json({ erreur: 'Variable OPENAI_API_KEY manquante' }, { status: 500 })
  }

  // ─── Construction du prompt ───────────────────────────────────────────────
  // On sérialise uniquement les champs utiles pour réduire les tokens
  const poiResume = poi_list.map((p) => ({
    nom: p.nom ?? p['rdfs:label'] ?? 'Inconnu',
    types: p.types ?? [],
  }))

  const promptUtilisateur = `Destination touristique : ${destination}

Liste de POI disponibles (${poi_list.length} entrées) :
${JSON.stringify(poiResume, null, 2)}

Sélectionne les 3 POI les plus représentatifs et touristiquement pertinents pour ${destination}.
Réponds avec ce JSON exact :
{
  "poi_selectionnes": [
    { "nom": "nom exact du POI", "raison": "pourquoi ce POI est pertinent" },
    { "nom": "...", "raison": "..." },
    { "nom": "...", "raison": "..." }
  ]
}`

  // ─── Appel OpenAI ─────────────────────────────────────────────────────────
  let contenuBrut = ''

  try {
    const response = await axios.post<OpenAIResponse>(
      OPENAI_URL,
      {
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content:
              'Tu es un expert en tourisme français. Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires).',
          },
          { role: 'user', content: promptUtilisateur },
        ],
        temperature: 0.2,
        max_tokens: 200,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20_000,
      }
    )

    contenuBrut = response.data.choices?.[0]?.message?.content ?? ''
  } catch (err) {
    // Fallback : on prend les 3 premiers POI de la liste
    console.error('[poi-selection] Erreur appel OpenAI :', err)
    return NextResponse.json({
      poi_selectionnes: poi_list.slice(0, 3).map((p) => ({
        nom: String(p.nom ?? p['rdfs:label'] ?? 'POI inconnu'),
        raison: 'Sélection par défaut (erreur OpenAI)',
      })),
      cout: {
        openai: { nb_appels: 1, cout_unitaire: API_COSTS.openai_gpt5_mini, cout_total: API_COSTS.openai_gpt5_mini },
      },
    })
  }

  // ─── Parsing du JSON ──────────────────────────────────────────────────────
  try {
    const nettoye = contenuBrut.replace(/```json\n?|```/g, '').trim()
    const parsed = JSON.parse(nettoye)

    const resultat: ReponsePoiSelection = {
      poi_selectionnes: parsed.poi_selectionnes ?? [],
      cout: {
        openai: {
          nb_appels: 1,
          cout_unitaire: API_COSTS.openai_gpt5_mini,
          cout_total: API_COSTS.openai_gpt5_mini,
        },
      },
    }

    return NextResponse.json(resultat)
  } catch {
    // Fallback parsing : 3 premiers POI de la liste
    console.error('[poi-selection] Erreur parsing OpenAI, raw :', contenuBrut)
    return NextResponse.json({
      poi_selectionnes: poi_list.slice(0, 3).map((p) => ({
        nom: String(p.nom ?? p['rdfs:label'] ?? 'POI inconnu'),
        raison: 'Sélection par défaut (parsing échoué)',
      })),
      cout: {
        openai: { nb_appels: 1, cout_unitaire: API_COSTS.openai_gpt5_mini, cout_total: API_COSTS.openai_gpt5_mini },
      },
    })
  }
}
