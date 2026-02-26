// Logique métier — Haloscan SEO
// Responsabilité : métriques SEO Haloscan pour UN domaine avec retry www.
// Retourne { domaine, donnees_valides, resultat } — la décision de fallback appartient à l'orchestrateur.
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { ResultatHaloscan } from '@/types/schema-digital'

const HALOSCAN_URL = 'https://api.haloscan.com/api/domains/overview'
const TIMEOUT_MS = 30_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function zeroHaloscan(domaine: string): ResultatHaloscan {
  return {
    domaine,
    total_keywords: 0,
    total_traffic: 0,
    top_3_positions: 0,
    top_10_positions: 0,
    visibility_index: 0,
    traffic_value: 0,
    site_non_indexe: true,
    source: 'haloscan',
  }
}

async function appelerHaloscan(
  domaine: string,
  apiKey: string
): Promise<{ donnees_valides: boolean; resultat: ResultatHaloscan }> {
  const response = await axios.post(
    HALOSCAN_URL,
    { input: domaine, mode: 'domain', requested_data: ['metrics', 'best_keywords', 'best_pages'] },
    { headers: { 'haloscan-api-key': apiKey }, timeout: TIMEOUT_MS }
  )

  // ⚠️ Niveau intermédiaire obligatoire : metrics.stats (validé sur réponse réelle www.lac-annecy.com)
  const metrics = (response.data.metrics?.stats as Record<string, number | string>) ?? {}
  const estVide =
    (response.data.metrics?.failure_reason !== null && response.data.metrics?.failure_reason !== undefined) ||
    (!metrics.total_keyword_count && !metrics.total_traffic)

  if (estVide) {
    return { donnees_valides: false, resultat: zeroHaloscan(domaine) }
  }

  return {
    donnees_valides: true,
    resultat: {
      domaine,
      total_keywords: (metrics.total_keyword_count as number) ?? 0,
      total_traffic: (metrics.total_traffic as number) ?? 0,
      top_3_positions: (metrics.top_3_positions as number) ?? 0,
      top_10_positions: (metrics.top_10_positions as number) ?? 0,
      visibility_index: (metrics.visibility_index as number) ?? 0,
      // traffic_value retourne "NA" (string) dans Haloscan — normalisation en 0
      traffic_value: typeof metrics.traffic_value === 'number' ? metrics.traffic_value : 0,
      site_non_indexe: false,
      source: 'haloscan',
    },
  }
}

// ─── Fonction exportée ────────────────────────────────────────────────────────

/**
 * Interroge Haloscan pour un domaine avec retry www. en cas d'absence de données.
 * Retourne toujours une structure valide — ne jamais bloquer.
 */
export async function executerHaloscan({ domaine }: { domaine: string }): Promise<{
  domaine: string
  donnees_valides: boolean
  resultat: ResultatHaloscan
  cout: { nb_appels: number; cout_unitaire: number; cout_total: number }
}> {
  if (!domaine) {
    throw new Error('Paramètre domaine manquant')
  }

  const apiKey = process.env.HALOSCAN_API_KEY
  if (!apiKey) {
    throw new Error('Variable HALOSCAN_API_KEY manquante')
  }

  // Tentative 1 — domaine nu
  try {
    const res1 = await appelerHaloscan(domaine, apiKey)
    if (res1.donnees_valides) {
      return {
        domaine,
        donnees_valides: true,
        resultat: res1.resultat,
        cout: { nb_appels: 1, cout_unitaire: API_COSTS.haloscan, cout_total: API_COSTS.haloscan },
      }
    }
  } catch (err) {
    console.warn(`[Haloscan] Erreur domaine nu ${domaine} :`, err)
  }

  // Tentative 2 — retry www.
  if (!domaine.startsWith('www.')) {
    const domaineWww = `www.${domaine}`
    console.warn(`[Haloscan] ${domaine} sans données → retry ${domaineWww}`)
    try {
      const res2 = await appelerHaloscan(domaineWww, apiKey)
      if (res2.donnees_valides) {
        return {
          domaine,
          donnees_valides: true,
          resultat: { ...res2.resultat, domaine },  // domaine original conservé
          cout: { nb_appels: 2, cout_unitaire: API_COSTS.haloscan, cout_total: 2 * API_COSTS.haloscan },
        }
      }
    } catch (err) {
      console.warn(`[Haloscan] Erreur www ${domaineWww} :`, err)
    }
  }

  // Aucune donnée — retourner donnees_valides: false pour déclencher le fallback DataForSEO
  console.warn(`[Haloscan] ${domaine} non indexé (ni nu ni www)`)
  return {
    domaine,
    donnees_valides: false,
    resultat: zeroHaloscan(domaine),
    cout: { nb_appels: domaine.startsWith('www.') ? 1 : 2, cout_unitaire: API_COSTS.haloscan, cout_total: (domaine.startsWith('www.') ? 1 : 2) * API_COSTS.haloscan },
  }
}
