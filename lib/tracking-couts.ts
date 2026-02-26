// Tracking des coûts API par bloc et par audit
// Responsabilité : persister les coûts en base Supabase sans bloquer le flux principal

import { createClient } from '@supabase/supabase-js'

// Initialisation du client Supabase avec la clé service role (jamais exposée côté client)
function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes')
  }

  return createClient(url, key)
}

/**
 * Enregistre les coûts d'un bloc dans la colonne `couts_api` de la table `audits`.
 * Fusionne les données existantes — n'écrase jamais les autres blocs déjà en base.
 *
 * @param auditId - Identifiant de l'audit (UUID Supabase)
 * @param nomBloc - Nom du bloc (ex: "positionnement", "volume_affaires")
 * @param couts   - Objet de coûts à persister
 */
export async function enregistrerCoutsBloc(
  auditId: string,
  nomBloc: string,
  couts: object
): Promise<void> {
  try {
    const supabase = getSupabase()

    // Lecture de l'audit existant pour récupérer les coûts déjà enregistrés
    const { data: audit, error: erreurLecture } = await supabase
      .from('audits')
      .select('couts_api')
      .eq('id', auditId)
      .single()

    if (erreurLecture) {
      console.error(`[tracking-couts] Erreur lecture audit ${auditId} :`, erreurLecture.message)
      return
    }

    // Fusion des coûts existants avec le nouveau bloc — les autres blocs ne sont pas écrasés
    const coutsExistants = (audit?.couts_api as Record<string, object>) ?? {}
    const coutsMerges = { ...coutsExistants, [nomBloc]: couts }

    // Réécriture de la colonne couts_api
    const { error: erreurEcriture } = await supabase
      .from('audits')
      .update({ couts_api: coutsMerges })
      .eq('id', auditId)

    if (erreurEcriture) {
      console.error(`[tracking-couts] Erreur écriture audit ${auditId} :`, erreurEcriture.message)
    }
  } catch (err) {
    // Fallback silencieux — le tracking ne doit jamais faire planter le flux principal
    console.error('[tracking-couts] Erreur inattendue :', err)
  }
}
