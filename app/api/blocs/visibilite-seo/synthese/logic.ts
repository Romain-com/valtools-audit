// Logique métier — OpenAI synthèse gap SEO (Phase B)
// Responsabilité : calculer le gap transactionnel + top 5 opportunités + score 0-10
// ⚠️  Serveur uniquement — aucune clé API exposée côté client
// ⚠️  trafic_estime_capte = issu du CTR model appliqué sur keywords_positionnes_ot (déjà calculé en Phase A)
// ⚠️  taux_captation = trafic_estime_capte / volume_marche_seeds × 100, plafonné à 100%
// ⚠️  top_5_opportunites basé UNIQUEMENT sur les vrais_gaps confirmés par SERP live

import axios from 'axios'
import { parseOpenAIResponse } from '@/lib/openai-parse'
import { API_COSTS } from '@/lib/api-costs'
import type {
  KeywordClassifie,
  KeywordMarche,
  ResultatSERPTransac,
  Opportunite,
  ResultatPhaseB,
} from '@/types/visibilite-seo'

// URL de l'API OpenAI — Responses API
const OPENAI_URL = 'https://api.openai.com/v1/responses'
const TIMEOUT_MS = 180_000

// ─── Fonction exportée ────────────────────────────────────────────────────────

/**
 * Exécute la synthèse OpenAI du gap SEO transactionnel.
 * Croise les données Phase A (keywords classifiés) avec les résultats SERP live Phase B.
 */
export async function executerSyntheseVisibiliteSEO({
  destination,
  domaine_ot,
  keywords_classes,
  serp_results,
  paa_detectes,
  volume_marche_seeds,
  trafic_capte_ot_estime,
}: {
  destination: string
  domaine_ot: string
  keywords_classes: unknown[]
  serp_results: unknown[]
  paa_detectes: unknown[]
  volume_marche_seeds: number
  trafic_capte_ot_estime: number
}) {
  // keywords_classes et serp_results vides tolérés (domaine OT non indexé)
  if (!destination || !domaine_ot) {
    throw new Error('Paramètres destination et domaine_ot requis')
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Variable OPENAI_API_KEY manquante')
  }

  // Cast vers les types attendus
  const kw_classes = (keywords_classes ?? []) as KeywordClassifie[]
  const serp_res = (serp_results ?? []) as ResultatSERPTransac[]
  const paa_det = (paa_detectes ?? []) as KeywordMarche[]

  // ─── Trafic estimé capté ──────────────────────────────────────────────────
  // trafic_capte_ot_estime est déjà calculé avec le modèle CTR dans dataforseo-ranked/logic.ts.
  // On l'utilise directement — pas de double-calcul.
  const trafic_estime_capte = trafic_capte_ot_estime ?? 0

  // Taux de captation = trafic capté / volume marché total × 100, plafonné à 100%
  const vol_marche = volume_marche_seeds ?? 0
  const taux_captation = vol_marche > 0
    ? Math.min(100, Math.round((trafic_estime_capte / vol_marche) * 100 * 10) / 10)
    : 0

  // ─── Croisement Phase A ↔ SERP live → vrais_gaps ────────────────────────
  // Un "vrai gap" = keyword classifié gap en Phase A ET confirmé absent/mal classé par SERP live.
  // Si le SERP live révèle que l'OT est finalement bien positionné (pos ≤ 10), exclure.
  const serp_map = new Map<string, ResultatSERPTransac>()
  for (const s of serp_res) {
    serp_map.set(s.keyword.toLowerCase(), s)
  }

  interface VraiGap {
    keyword: string
    volume: number
    categorie: string
    position_ot: number | null
    concurrent_pos1: string | null
    gain_potentiel_trafic: number
    gap_confirme: boolean
  }

  const vrais_gaps: VraiGap[] = kw_classes
    .filter((kw) => kw.gap && kw.intent_transactionnel)
    .map((kw) => {
      const serp_live = serp_map.get(kw.keyword.toLowerCase())
      const position_live = serp_live ? serp_live.position_ot : kw.position_ot
      const gap_confirme = position_live === null || position_live > 20
      return {
        keyword: kw.keyword,
        volume: kw.volume,
        categorie: kw.categorie,
        position_ot: position_live,
        concurrent_pos1: serp_live?.concurrent_pos1 ?? null,
        gain_potentiel_trafic: Math.round(kw.volume * 0.10), // CTR pos 3 ≈ 10%
        gap_confirme,
      }
    })
    .filter((kw) => kw.gap_confirme)
    .sort((a, b) => b.volume - a.volume)

  // ─── Prompt OpenAI ───────────────────────────────────────────────────────
  const lignes_vrais_gaps = vrais_gaps
    .slice(0, 50)
    .map((g) => {
      const pos = g.position_ot !== null ? `pos_ot:${g.position_ot}` : 'OT:absent'
      const concurrent = g.concurrent_pos1 ?? 'inconnu'
      return `${g.keyword} | vol:${g.volume} | cat:${g.categorie} | ${pos} | pos1:${concurrent} | gain:${g.gain_potentiel_trafic}`
    })
    .join('\n')

  const prompt = `Tu es expert en SEO et marketing digital touristique. Analyse le gap SEO transactionnel du site ${domaine_ot} pour la destination ${destination}.

Données clés :
- Trafic estimé capté par l'OT : ${trafic_estime_capte.toLocaleString('fr-FR')} visites/mois (via CTR par position)
- Volume marché total détecté : ${vol_marche.toLocaleString('fr-FR')} recherches/mois
- Taux de captation : ${taux_captation}%
NOTE: taux_captation est calculé en amont — ne pas le recalculer.

Vrais gaps confirmés par SERP live (positions > 20 ou absentes) :
${lignes_vrais_gaps || 'Aucun gap confirmé'}

Questions PAA sans réponse sur le site OT :
${paa_det.slice(0, 20).map((p) => `- ${p.keyword}`).join('\n')}

RÈGLES STRICTES :
- top_5_opportunites : choisir UNIQUEMENT parmi les keywords listés dans "vrais gaps" ci-dessus
- Ne jamais inclure un keyword avec position_ot ≤ 10
- Priorité aux keywords avec concurrent_pos1 identifié (on sait qui surpasser)
- gain_potentiel_trafic : reprendre la valeur "gain" de la liste ci-dessus (ne pas recalculer)

Retourne UNIQUEMENT ce JSON valide (sans markdown, sans commentaires) :
{
  "top_5_opportunites": [
    {
      "keyword": "string",
      "volume": number,
      "categorie": "string",
      "position_ot": number_ou_null,
      "concurrent_pos1": "string_ou_null",
      "gain_potentiel_trafic": number
    }
  ],
  "paa_sans_reponse": ["question 1", "question 2"],
  "score_gap": number_entre_0_et_10,
  "synthese_narrative": "2-3 phrases résumant le gap et les opportunités prioritaires pour un directeur d'OT"
}`

  try {
    const response = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-5-mini',
        input: prompt,
        max_output_tokens: 2000,
        reasoning: { effort: 'medium' },
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: TIMEOUT_MS,
      }
    )

    const brut = parseOpenAIResponse(response.data)
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())

    const resultat: ResultatPhaseB = {
      serp_results: serp_res,
      volume_marche_transactionnel: vol_marche,
      trafic_estime_capte,
      taux_captation,
      top_5_opportunites: (parsed.top_5_opportunites ?? []) as Opportunite[],
      paa_sans_reponse: parsed.paa_sans_reponse ?? [],
      score_gap: parsed.score_gap ?? 0,
      synthese_narrative: parsed.synthese_narrative ?? '',
      statut: 'terminé',
    }

    return {
      ...resultat,
      cout: {
        nb_appels: 1,
        cout_unitaire: API_COSTS.openai_gpt5_mini,
        cout_total: API_COSTS.openai_gpt5_mini,
      },
    }
  } catch (err) {
    console.error('[synthese] Erreur OpenAI :', (err as Error).message)

    // Fallback sans OpenAI — calculer les opportunités directement depuis vrais_gaps
    const top_5_opportunites = vrais_gaps
      .slice(0, 5)
      .map((g) => ({
        keyword: g.keyword,
        volume: g.volume,
        categorie: g.categorie,
        position_ot: g.position_ot,
        concurrent_pos1: g.concurrent_pos1,
        gain_potentiel_trafic: g.gain_potentiel_trafic,
      }))

    return {
      serp_results: serp_res,
      volume_marche_transactionnel: vol_marche,
      trafic_estime_capte,
      taux_captation,
      top_5_opportunites,
      paa_sans_reponse: paa_det.slice(0, 5).map((p) => p.keyword),
      score_gap: 5,
      synthese_narrative: `Analyse automatique : ${domaine_ot} capte ${taux_captation}% du marché détecté.`,
      statut: 'terminé',
      cout: {
        nb_appels: 1,
        cout_unitaire: API_COSTS.openai_gpt5_mini,
        cout_total: API_COSTS.openai_gpt5_mini,
      },
    }
  }
}
