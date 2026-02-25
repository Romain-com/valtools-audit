// Wrapper Bloc 5 — Stocks physiques (DATA Tourisme + SIRENE)
// Responsabilité : adapter la signature de lancerBlocStocksPhysiques() à l'interface standard

import { lancerBlocStocksPhysiques } from '@/lib/blocs/stocks-physiques'
import type { ParamsAudit, ResultatBloc } from '../blocs-statuts'

/**
 * Lance le Bloc 5 et retourne les résultats au format standard de l'orchestrateur.
 */
export async function lancerBloc5(params: ParamsAudit): Promise<ResultatBloc> {
  const resultat = await lancerBlocStocksPhysiques({
    destination: params.nom,
    code_insee: params.code_insee,
    audit_id: params.audit_id,
  })

  return {
    resultats: resultat as unknown as Record<string, unknown>,
    couts: {
      total: resultat.meta?.cout_total_euros ?? 0,
      total_bloc: resultat.meta?.cout_total_euros ?? 0,
    },
  }
}
