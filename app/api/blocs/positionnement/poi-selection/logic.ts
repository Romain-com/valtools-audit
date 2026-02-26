// Logique métier — Sélection IA des POI représentatifs
// Responsabilité : demander à OpenAI de choisir les 3 POI les plus pertinents parmi la liste brute
// Importé directement par l'orchestrateur pour éviter les appels HTTP auto-référentiels

import axios from 'axios'
import { parseOpenAIResponse } from '@/lib/openai-parse'
import { API_COSTS } from '@/lib/api-costs'
import type { POIBrut, POISelectionne } from '@/types/positionnement'

// URL de l'API OpenAI — Responses API
const OPENAI_URL = 'https://api.openai.com/v1/responses'

interface ReponsePoiSelection {
  poi_selectionnes: POISelectionne[]
  erreur?: string
  cout?: object
}

/**
 * Demande à OpenAI de sélectionner les 3 POI les plus pertinents pour une destination donnée.
 * En cas d'erreur ou de liste vide, retourne les 3 premiers POI de la liste (fallback).
 */
export async function executerPOISelection({
  destination,
  poi_list,
}: {
  destination: string
  poi_list?: POIBrut[]
}): Promise<ReponsePoiSelection> {
  if (!destination) {
    throw new Error('Paramètre destination manquant')
  }

  // Cas : liste vide — pas d'appel OpenAI, on retourne immédiatement
  if (!poi_list || poi_list.length === 0) {
    return {
      poi_selectionnes: [],
      erreur: 'liste_vide',
    }
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('Variable OPENAI_API_KEY manquante')
  }

  // ─── Construction du prompt ───────────────────────────────────────────────
  // On sérialise uniquement les champs utiles pour réduire les tokens
  const poiResume = poi_list.map((p) => ({
    nom: p.nom ?? p['rdfs:label'] ?? 'Inconnu',
    types: p.types ?? [],
  }))

  const promptUtilisateur = `Tu es un expert en tourisme français. Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires).

Destination touristique : ${destination}

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

  // ─── Appel OpenAI — Responses API ─────────────────────────────────────────
  let contenuBrut = ''

  try {
    const response = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-5-mini',
        input: promptUtilisateur,
        max_output_tokens: 500,
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
    // Fallback : on prend les 3 premiers POI de la liste
    const e = err as { message?: string }
    console.error('[poi-selection] Erreur appel OpenAI :', e.message)
    return {
      poi_selectionnes: poi_list.slice(0, 3).map((p) => ({
        nom: String(p.nom ?? p['rdfs:label'] ?? 'POI inconnu'),
        raison: 'Sélection par défaut (erreur OpenAI)',
      })),
      cout: {
        openai: { nb_appels: 1, cout_unitaire: API_COSTS.openai_gpt5_mini, cout_total: API_COSTS.openai_gpt5_mini },
      },
    }
  }

  // ─── Parsing du JSON ──────────────────────────────────────────────────────
  try {
    const nettoye = contenuBrut.replace(/```json\n?|```/g, '').trim()
    const parsed = JSON.parse(nettoye)

    return {
      poi_selectionnes: parsed.poi_selectionnes ?? [],
      cout: {
        openai: {
          nb_appels: 1,
          cout_unitaire: API_COSTS.openai_gpt5_mini,
          cout_total: API_COSTS.openai_gpt5_mini,
        },
      },
    }
  } catch {
    // Fallback parsing : 3 premiers POI de la liste
    console.error('[poi-selection] Erreur parsing OpenAI, raw :', contenuBrut)
    return {
      poi_selectionnes: poi_list.slice(0, 3).map((p) => ({
        nom: String(p.nom ?? p['rdfs:label'] ?? 'POI inconnu'),
        raison: 'Sélection par défaut (parsing échoué)',
      })),
      cout: {
        openai: { nb_appels: 1, cout_unitaire: API_COSTS.openai_gpt5_mini, cout_total: API_COSTS.openai_gpt5_mini },
      },
    }
  }
}
