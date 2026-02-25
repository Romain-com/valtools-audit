// Wrapper Bloc 1 — Positionnement & Notoriété
// Responsabilité : adapter la signature de auditPositionnement() à l'interface standard ResultatBloc

import { auditPositionnement } from '@/lib/blocs/positionnement'
import type { ParamsAudit, ResultatBloc } from '../blocs-statuts'

/**
 * Lance le Bloc 1 et retourne les résultats au format standard de l'orchestrateur.
 *
 * Hashtag Instagram : nom de la destination normalisé (minuscules, sans espaces ni accents)
 */
export async function lancerBloc1(params: ParamsAudit): Promise<ResultatBloc> {
  // Normalisation du hashtag : minuscules + suppression des espaces + accents
  const hashtag = params.nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')

  const resultat = await auditPositionnement(
    params.audit_id,
    params.nom,
    params.code_insee,
    hashtag
  )

  return {
    resultats: resultat as unknown as Record<string, unknown>,
    couts: {
      total: resultat.couts_bloc?.total_bloc ?? 0,
      total_bloc: resultat.couts_bloc?.total_bloc ?? 0,
      detail: resultat.couts_bloc,
    },
  }
}
