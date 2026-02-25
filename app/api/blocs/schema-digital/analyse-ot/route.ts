// Route Handler — Analyse du site Office de Tourisme
// Responsabilité : inférer les fonctionnalités et la maturité digitale du site OT
//   à partir de son URL, titre et meta description (sans scraping)
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { AnalyseSiteOT } from '@/types/schema-digital'

// URL de l'API OpenAI
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { destination, domaine_ot, titre_ot, meta_description_ot, url_ot } = body as {
    destination?: string
    domaine_ot?: string
    titre_ot?: string
    meta_description_ot?: string
    url_ot?: string
  }

  if (!destination || !domaine_ot) {
    return NextResponse.json(
      { erreur: 'Paramètres destination et domaine_ot requis' },
      { status: 400 }
    )
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ erreur: 'Variable OPENAI_API_KEY manquante' }, { status: 500 })
  }

  const promptUtilisateur = `Site officiel de l'office de tourisme de ${destination} :
URL : ${url_ot ?? `https://${domaine_ot}`}
Titre : ${titre_ot ?? '(non disponible)'}
Description : ${meta_description_ot ?? '(non disponible)'}

À partir de ces informations, identifie les fonctionnalités probables du site.

JSON attendu :
{
  "fonctionnalites_detectees": {
    "moteur_reservation": true,
    "blog_actualites": true,
    "newsletter": "incertain",
    "agenda_evenements": true,
    "carte_interactive": "incertain",
    "application_mobile": false
  },
  "niveau_maturite_digital": "avance",
  "commentaire": "1-2 phrases sur la maturité digitale observable"
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
              "Tu es expert en marketing digital pour les offices de tourisme français. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.",
          },
          { role: 'user', content: promptUtilisateur },
        ],
        temperature: 0.1,
        max_tokens: 300,
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
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim()) as AnalyseSiteOT

    return NextResponse.json({
      ...parsed,
      cout: {
        nb_appels: 1,
        cout_unitaire: API_COSTS.openai_gpt5_mini,
        cout_total: API_COSTS.openai_gpt5_mini,
      },
    })
  } catch (err) {
    // Erreur non bloquante — l'analyse OT est un enrichissement optionnel
    console.error('[Analyse OT] Erreur OpenAI :', err)
    return NextResponse.json({
      fonctionnalites_detectees: {
        moteur_reservation: 'incertain',
        blog_actualites: 'incertain',
        newsletter: 'incertain',
        agenda_evenements: 'incertain',
        carte_interactive: 'incertain',
        application_mobile: 'incertain',
      },
      niveau_maturite_digital: 'moyen',
      commentaire: '',
      erreur: err instanceof Error ? err.message : 'Erreur inconnue',
      cout: {
        nb_appels: 1,
        cout_unitaire: API_COSTS.openai_gpt5_mini,
        cout_total: API_COSTS.openai_gpt5_mini,
      },
    })
  }
}
