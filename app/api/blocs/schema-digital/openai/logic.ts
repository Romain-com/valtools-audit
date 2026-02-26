// Logique métier — Synthèse OpenAI du Bloc 3
// Responsabilité : générer une analyse narrative du schéma digital
//   à partir des données SERP, Haloscan et PageSpeed
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import axios from 'axios'
import { parseOpenAIResponse } from '@/lib/openai-parse'
import { API_COSTS } from '@/lib/api-costs'
import type { SiteOfficiel, ResultatHaloscan, ResultatPageSpeed } from '@/types/schema-digital'

// URL de l'API OpenAI — Responses API
const OPENAI_URL = 'https://api.openai.com/v1/responses'

// ─── Helpers de formatage pour le prompt ──────────────────────────────────────

/**
 * Résume les données Haloscan d'un domaine en texte lisible pour le prompt.
 */
function resumeHaloscan(h: ResultatHaloscan): string {
  if (h.site_non_indexe) return `${h.domaine} : non indexé sur Haloscan`
  return `${h.domaine} : ${h.total_keywords.toLocaleString('fr-FR')} mots-clés, ${h.total_traffic.toLocaleString('fr-FR')} visites/mois, indice visibilité ${h.visibility_index}`
}

/**
 * Résume les scores PageSpeed d'un domaine en texte lisible pour le prompt.
 */
function resumePageSpeed(p: ResultatPageSpeed): string {
  if (p.erreur || !p.mobile || !p.desktop) return `${p.domaine} : erreur ou données indisponibles`
  return `${p.domaine} : mobile ${p.mobile.score}/100 (LCP ${p.mobile.lcp}s), desktop ${p.desktop.score}/100 (LCP ${p.desktop.lcp}s)`
}

// ─── Fonction exportée ────────────────────────────────────────────────────────

/**
 * Génère une synthèse narrative du schéma digital via OpenAI.
 * En cas d'erreur, retourne des champs vides sans bloquer l'audit.
 */
export async function executerOpenAISchemaDigital({
  destination,
  top3_officiels,
  haloscan,
  pagespeed,
  nb_sites_officiels_top10,
  nb_ota_top10,
}: {
  destination: string
  top3_officiels?: SiteOfficiel[]
  haloscan?: ResultatHaloscan[]
  pagespeed?: ResultatPageSpeed[]
  nb_sites_officiels_top10?: number
  nb_ota_top10?: number
}): Promise<{
  synthese_schema: string
  indicateurs_cles: string[]
  points_attention: string[]
  erreur?: string
  cout: { nb_appels: number; cout_unitaire: number; cout_total: number }
}> {
  if (!destination) {
    throw new Error('Paramètre destination manquant')
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Variable OPENAI_API_KEY manquante')
  }

  // Formatage des top 3 officiels pour le prompt
  const resumeTop3 = (top3_officiels ?? [])
    .map((s) => `  - ${s.domaine} (${s.categorie}) — position ${s.position_serp}`)
    .join('\n') || '  - Aucun site officiel identifié'

  // Formatage des données Haloscan
  const resumeHaloscanTexte = (haloscan ?? []).map(resumeHaloscan).join('\n') || 'Données SEO non disponibles'

  // Formatage des données PageSpeed
  const resumePageSpeedTexte = (pagespeed ?? []).map(resumePageSpeed).join('\n') || 'Données techniques non disponibles'

  const promptUtilisateur = `Tu es expert en audit digital pour les destinations touristiques françaises. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.

Destination : ${destination}

SERP Google :
- ${nb_sites_officiels_top10 ?? 0} sites officiels dans le Top 10
- ${nb_ota_top10 ?? 0} plateformes OTA dans le Top 10
- Top 3 officiels :
${resumeTop3}

Visibilité SEO (Haloscan) :
${resumeHaloscanTexte}

Santé technique (PageSpeed) :
${resumePageSpeedTexte}

Génère une analyse synthétique pour un rapport d'audit digital.

JSON attendu :
{
  "synthese_schema": "80-100 mots pour GDoc",
  "indicateurs_cles": ["constat 1", "constat 2", "constat 3"],
  "points_attention": ["point 1", "point 2"]
}`

  try {
    const response = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-5-mini',
        input: promptUtilisateur,
        max_output_tokens: 1000,
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

    const brut = parseOpenAIResponse(response.data)
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())

    return {
      ...parsed,
      cout: {
        nb_appels: 1,
        cout_unitaire: API_COSTS.openai_gpt5_mini,
        cout_total: API_COSTS.openai_gpt5_mini,
      },
    }
  } catch (err) {
    console.error('[OpenAI Schéma] Erreur :', err)
    return {
      synthese_schema: '',
      indicateurs_cles: [],
      points_attention: [],
      erreur: err instanceof Error ? err.message : 'Erreur inconnue',
      cout: {
        nb_appels: 1,
        cout_unitaire: API_COSTS.openai_gpt5_mini,
        cout_total: API_COSTS.openai_gpt5_mini,
      },
    }
  }
}
