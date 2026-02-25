// Wrapper Bloc 6 — Stock commercialisé en ligne (Airbnb, Booking, Viator, site OT)
// Responsabilité : adapter la signature de lancerBlocStockEnLigne() à l'interface standard
// ⚠️ Nécessite Playwright — doit tourner dans un segment avec runtime 'nodejs'

import { lancerBlocStockEnLigne } from '@/lib/blocs/stock-en-ligne'
import type { ParamsAudit, ResultatBloc } from '../blocs-statuts'
import { lireResultatsBloc } from '../supabase-updates'

/**
 * Lance le Bloc 6 et retourne les résultats au format standard de l'orchestrateur.
 * Utilise les stocks physiques du Bloc 5 si disponibles pour les indicateurs croisés.
 */
export async function lancerBloc6(params: ParamsAudit): Promise<ResultatBloc> {
  const domaine_ot = params.domaine_ot ?? ''

  // Lecture des stocks physiques (Bloc 5) pour les indicateurs croisés — optionnel
  let stocks_bloc5: Parameters<typeof lancerBlocStockEnLigne>[1] | undefined

  try {
    const bloc5 = await lireResultatsBloc(params.audit_id, 'stocks_physiques') as {
      stocks?: {
        hebergements?: { total: number }
        activites?: { total: number }
      }
    } | null

    if (bloc5?.stocks) {
      stocks_bloc5 = {
        hebergements_total: bloc5.stocks.hebergements?.total ?? 0,
        activites_total: bloc5.stocks.activites?.total ?? 0,
      }
    }
  } catch {
    // Fallback silencieux — les indicateurs croisés seront à 0
  }

  const resultat = await lancerBlocStockEnLigne(
    {
      destination: params.nom,
      code_insee: params.code_insee,
      domaine_ot,
      audit_id: params.audit_id,
    },
    stocks_bloc5
  )

  return {
    resultats: resultat as unknown as Record<string, unknown>,
    couts: {
      total: 0.001,
      total_bloc: 0.001,
    },
  }
}
