// Logique métier — DataForSEO Domain Analytics
// Responsabilité : métriques SEO DataForSEO domain_rank_overview pour UN domaine
//   Fallback de Haloscan quand le domaine n'est pas indexé.
// ⚠️  Serveur uniquement — aucune clé API exposée côté client
// ⚠️  Parsing validé sur réponse réelle : tasks[0].result[0].items[0].metrics.organic
//     (niveau items intermédiaire — NE PAS utiliser tasks[0].result[0].metrics.organic)

import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { ResultatHaloscan } from '@/types/schema-digital'

const DATAFORSEO_URL = 'https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live'
const TIMEOUT_MS = 30_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Appelle DataForSEO pour un target donné.
 * ⚠️ Chemin validé sur réponse réelle : items[0].metrics.organic (niveau items intermédiaire)
 * Retourne null si count === 0 ou absent.
 */
async function appelBrut(target: string) {
  const auth = {
    username: process.env.DATAFORSEO_LOGIN!,
    password: process.env.DATAFORSEO_PASSWORD!,
  }

  const response = await axios.post(
    DATAFORSEO_URL,
    [{ target, location_code: 2250, language_code: 'fr' }],
    { auth, timeout: TIMEOUT_MS }
  )

  // ⚠️ items[0] — niveau intermédiaire obligatoire
  const organic = response.data?.tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic
  if (!organic || !organic.count) return null

  return organic as Record<string, number>
}

function construireResultat(organic: Record<string, number>, domaine: string): ResultatHaloscan {
  return {
    domaine,
    total_keywords: organic.count ?? 0,
    total_traffic: organic.estimated_traffic_monthly ?? 0,
    top_3_positions: organic.pos_1_3 ?? 0,
    top_10_positions: (organic.pos_1_3 ?? 0) + (organic.pos_4_10 ?? 0),
    visibility_index: organic.rank_absolute ?? 0,
    traffic_value: 0,  // non disponible dans DataForSEO
    site_non_indexe: false,
    source: 'dataforseo',
  }
}

// ─── Fonction exportée ────────────────────────────────────────────────────────

/**
 * Interroge DataForSEO domain_rank_overview pour un domaine avec retry www.
 * Utilisé comme fallback quand Haloscan ne retourne pas de données.
 */
export async function executerDomainAnalytics({ domaine }: { domaine: string }): Promise<
  ResultatHaloscan & { cout: { nb_appels: number; cout_unitaire: number; cout_total: number } }
> {
  if (!domaine) {
    throw new Error('Paramètre domaine manquant')
  }

  // Tentative 1 — domaine nu
  try {
    const organic1 = await appelBrut(domaine)
    if (organic1) {
      return {
        ...construireResultat(organic1, domaine),
        cout: { nb_appels: 1, cout_unitaire: API_COSTS.dataforseo_domain, cout_total: API_COSTS.dataforseo_domain },
      }
    }
  } catch (err) {
    console.warn(`[DataForSEO] Erreur domaine nu ${domaine} :`, err)
  }

  // Tentative 2 — retry www.
  if (!domaine.startsWith('www.')) {
    const domaineWww = `www.${domaine}`
    console.warn(`[DataForSEO] ${domaine} count=0 → retry ${domaineWww}`)
    try {
      const organic2 = await appelBrut(domaineWww)
      if (organic2) {
        return {
          ...construireResultat(organic2, domaine),  // domaine original conservé
          cout: { nb_appels: 2, cout_unitaire: API_COSTS.dataforseo_domain, cout_total: 2 * API_COSTS.dataforseo_domain },
        }
      }
    } catch (err) {
      console.warn(`[DataForSEO] Erreur www ${domaineWww} :`, err)
    }
  }

  // Aucune donnée
  return {
    domaine,
    total_keywords: 0,
    total_traffic: 0,
    top_3_positions: 0,
    top_10_positions: 0,
    visibility_index: 0,
    traffic_value: 0,
    site_non_indexe: true,
    source: 'dataforseo' as const,
    cout: { nb_appels: domaine.startsWith('www.') ? 1 : 2, cout_unitaire: API_COSTS.dataforseo_domain, cout_total: (domaine.startsWith('www.') ? 1 : 2) * API_COSTS.dataforseo_domain },
  }
}
