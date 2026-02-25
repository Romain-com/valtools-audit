// Wrapper Bloc 2 — Volume d'affaires (taxe de séjour)
// Responsabilité : adapter la signature de lancerBlocVolumeAffaires() à l'interface standard

import { lancerBlocVolumeAffaires } from '@/lib/blocs/volume-affaires'
import type { ParamsAudit, ResultatBloc } from '../blocs-statuts'

/**
 * Lance le Bloc 2 et retourne les résultats au format standard de l'orchestrateur.
 */
export async function lancerBloc2(params: ParamsAudit): Promise<ResultatBloc> {
  const resultat = await lancerBlocVolumeAffaires(
    params.nom,
    params.siren,
    params.code_insee,
    params.code_departement,
    params.population,
    params.audit_id
  )

  return {
    resultats: resultat as unknown as Record<string, unknown>,
    couts: {
      total: resultat.meta?.cout_total_euros ?? 0,
      total_bloc: resultat.meta?.cout_total_euros ?? 0,
    },
  }
}
