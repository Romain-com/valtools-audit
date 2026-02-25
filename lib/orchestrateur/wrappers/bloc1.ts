// Wrapper Bloc 1 — Positionnement & Notoriété
// Responsabilité : adapter la signature de auditPositionnement() à l'interface standard ResultatBloc

import { auditPositionnement } from '@/lib/blocs/positionnement'
import type { ParamsAudit, ResultatBloc } from '../blocs-statuts'
import { logInfo } from '../logger'

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

  // ── Diagnostic — valeurs clés du Bloc 1 ──
  const google = (resultat as Record<string, unknown>).google as Record<string, unknown> | undefined
  const ot = google?.ot as Record<string, unknown> | undefined
  const instagram = (resultat as Record<string, unknown>).instagram as Record<string, unknown> | undefined
  const positionnement_ia = (resultat as Record<string, unknown>).positionnement_ia as Record<string, unknown> | undefined
  logInfo(params.audit_id, 'Bloc 1 — résultats reçus', 'bloc1', {
    note_ot: ot?.note ?? null,
    nb_avis_ot: ot?.avis ?? null,
    posts_count_instagram: instagram?.posts_count ?? null,
    hashtag_utilise: hashtag,
    axe_principal: positionnement_ia?.axe_principal ?? null,
    cout_bloc: resultat.couts_bloc?.total_bloc ?? 0,
  })

  return {
    resultats: resultat as unknown as Record<string, unknown>,
    couts: {
      total: resultat.couts_bloc?.total_bloc ?? 0,
      total_bloc: resultat.couts_bloc?.total_bloc ?? 0,
      detail: resultat.couts_bloc,
    },
  }
}
