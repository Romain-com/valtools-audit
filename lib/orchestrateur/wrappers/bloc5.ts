// Wrapper Bloc 5 — Stocks physiques (DATA Tourisme + SIRENE)
// Responsabilité : adapter la signature de lancerBlocStocksPhysiques() à l'interface standard

import { lancerBlocStocksPhysiques } from '@/lib/blocs/stocks-physiques'
import type { ParamsAudit, ResultatBloc } from '../blocs-statuts'
import { logInfo } from '../logger'

/**
 * Lance le Bloc 5 et retourne les résultats au format standard de l'orchestrateur.
 */
export async function lancerBloc5(params: ParamsAudit): Promise<ResultatBloc> {
  const resultat = await lancerBlocStocksPhysiques({
    destination: params.nom,
    code_insee: params.code_insee,
    audit_id: params.audit_id,
  })

  // ── Diagnostic — valeurs clés du Bloc 5 ──
  const r = resultat as unknown as Record<string, unknown>
  const stocks = r.stocks as Record<string, unknown> | undefined
  const hebergements = stocks?.hebergements as Record<string, unknown> | undefined
  const activites = stocks?.activites as Record<string, unknown> | undefined
  logInfo(params.audit_id, 'Bloc 5 — résultats reçus', 'bloc5', {
    total_hebergements: hebergements?.total ?? null,
    total_activites: activites?.total ?? null,
    total_stock_physique: ((hebergements?.total as number) ?? 0) + ((activites?.total as number) ?? 0),
    source_donnee: r.source_donnee ?? null,
    cout_bloc: resultat.meta?.cout_total_euros ?? 0,
  })

  return {
    resultats: resultat as unknown as Record<string, unknown>,
    couts: {
      total: resultat.meta?.cout_total_euros ?? 0,
      total_bloc: resultat.meta?.cout_total_euros ?? 0,
    },
  }
}
