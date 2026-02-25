// Route Handler — Synthèse OpenAI du Bloc 3
// Responsabilité : générer une analyse narrative du schéma digital
//   à partir des données SERP, Haloscan et PageSpeed
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { SiteOfficiel, ResultatHaloscan, ResultatPageSpeed } from '@/types/schema-digital'

// URL de l'API OpenAI
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

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

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const {
    destination,
    top3_officiels,
    haloscan,
    pagespeed,
    nb_sites_officiels_top10,
    nb_ota_top10,
  } = body as {
    destination?: string
    top3_officiels?: SiteOfficiel[]
    haloscan?: ResultatHaloscan[]
    pagespeed?: ResultatPageSpeed[]
    nb_sites_officiels_top10?: number
    nb_ota_top10?: number
  }

  if (!destination) {
    return NextResponse.json({ erreur: 'Paramètre destination manquant' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ erreur: 'Variable OPENAI_API_KEY manquante' }, { status: 500 })
  }

  // Formatage des top 3 officiels pour le prompt
  const resumeTop3 = (top3_officiels ?? [])
    .map((s) => `  - ${s.domaine} (${s.categorie}) — position ${s.position_serp}`)
    .join('\n') || '  - Aucun site officiel identifié'

  // Formatage des données Haloscan
  const resumeHaloscanTexte = (haloscan ?? []).map(resumeHaloscan).join('\n') || 'Données SEO non disponibles'

  // Formatage des données PageSpeed
  const resumePageSpeedTexte = (pagespeed ?? []).map(resumePageSpeed).join('\n') || 'Données techniques non disponibles'

  const promptUtilisateur = `Destination : ${destination}

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
        messages: [
          {
            role: 'system',
            content:
              "Tu es expert en audit digital pour les destinations touristiques françaises. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.",
          },
          { role: 'user', content: promptUtilisateur },
        ],
        temperature: 0.2,
        max_tokens: 500,
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
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())

    return NextResponse.json({
      ...parsed,
      cout: {
        nb_appels: 1,
        cout_unitaire: API_COSTS.openai_gpt5_mini,
        cout_total: API_COSTS.openai_gpt5_mini,
      },
    })
  } catch (err) {
    console.error('[OpenAI Schéma] Erreur :', err)
    return NextResponse.json({
      synthese_schema: '',
      indicateurs_cles: [],
      points_attention: [],
      erreur: err instanceof Error ? err.message : 'Erreur inconnue',
      cout: {
        nb_appels: 1,
        cout_unitaire: API_COSTS.openai_gpt5_mini,
        cout_total: API_COSTS.openai_gpt5_mini,
      },
    })
  }
}
