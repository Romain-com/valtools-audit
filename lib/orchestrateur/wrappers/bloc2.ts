// Wrapper Bloc 2 — Volume d'affaires (taxe de séjour)
// Responsabilité : adapter la signature de lancerBlocVolumeAffaires() à l'interface standard

import { lancerBlocVolumeAffaires } from '@/lib/blocs/volume-affaires'
import type { ParamsAudit, ResultatBloc } from '../blocs-statuts'
import { logInfo } from '../logger'

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

  // ── Diagnostic — valeurs clés du Bloc 2 ──
  const collecteur = (resultat as Record<string, unknown>).collecteur as Record<string, unknown> | undefined
  logInfo(params.audit_id, 'Bloc 2 — résultats reçus', 'bloc2', {
    montant_taxe_euros: collecteur?.montant_taxe_euros ?? null,
    type_collecteur: collecteur?.type_collecteur ?? null,
    nuitees_estimees: collecteur?.nuitees_estimees ?? null,
    source_donnee: collecteur?.source_donnee ?? null,
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
