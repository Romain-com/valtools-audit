// Utilitaires Supabase pour l'orchestrateur principal
// Responsabilité : mettre à jour les audits et destinations en utilisant
//                  l'opérateur JSONB || pour ne jamais écraser les données existantes

import { createClient } from '@supabase/supabase-js'
import type { BlocsStatuts, StatutBloc, ParamsAudit } from './blocs-statuts'
import { BLOCS_RESULTATS_KEYS } from './blocs-statuts'
import { logInfo } from './logger'

// ─── Client Supabase service role ────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes')
  }

  return createClient(url, key)
}

// ─── Mise à jour statut d'un bloc ─────────────────────────────────────────────

/**
 * Met à jour le statut d'un bloc dans blocs_statuts + sauvegarde ses résultats.
 * Utilise l'opérateur || pour merger sans écraser les autres blocs.
 *
 * @param auditId  - UUID de l'audit
 * @param nomBloc  - Clé du bloc (ex: 'bloc1')
 * @param statut   - Nouveau statut
 * @param resultats - Données à stocker dans audits.resultats (optionnel)
 * @param couts    - Coûts à merger dans audits.couts_api (optionnel)
 */
export async function mettreAJourBloc(
  auditId: string,
  nomBloc: keyof BlocsStatuts,
  statut: StatutBloc,
  resultats?: Record<string, unknown>,
  couts?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabase()

  // Lecture de l'audit existant pour merger les JSONB
  const { data: audit, error: errLecture } = await supabase
    .from('audits')
    .select('resultats, couts_api')
    .eq('id', auditId)
    .single()

  if (errLecture || !audit) {
    throw new Error(`[supabase-updates] Impossible de lire audit ${auditId} : ${errLecture?.message}`)
  }

  const resultatsActuels = (audit.resultats as Record<string, unknown>) ?? {}
  const coutsActuels = (audit.couts_api as Record<string, unknown>) ?? {}

  // Merger les blocs_statuts
  const blocsStatutsActuels = (resultatsActuels.blocs_statuts ?? {}) as Record<string, string>
  const nouveauxBlocsStatuts = { ...blocsStatutsActuels, [nomBloc]: statut }

  // Construire le nouveau JSONB resultats
  const clesResultatBloc = BLOCS_RESULTATS_KEYS[nomBloc]
  const nouveauxResultats: Record<string, unknown> = {
    ...resultatsActuels,
    blocs_statuts: nouveauxBlocsStatuts,
  }

  // Stocker les résultats du bloc si fournis
  if (resultats !== undefined) {
    nouveauxResultats[clesResultatBloc] = resultats
  }

  // Construire le nouveau JSONB couts_api
  let nouveauxCouts = coutsActuels
  if (couts !== undefined) {
    // Recalculer le total global
    const coutsMerges = { ...coutsActuels, [nomBloc]: couts }
    const totalAudit = Object.values(coutsMerges)
      .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
      .reduce((sum, bloc) => {
        const t = (bloc.total ?? bloc.total_bloc ?? 0) as number
        return sum + t
      }, 0)

    nouveauxCouts = { ...coutsMerges, total_audit: totalAudit }
  }

  // Mise à jour Supabase
  const { error: errEcriture } = await supabase
    .from('audits')
    .update({
      resultats: nouveauxResultats,
      couts_api: nouveauxCouts,
    })
    .eq('id', auditId)

  if (errEcriture) {
    throw new Error(`[supabase-updates] Erreur mise à jour bloc ${nomBloc} : ${errEcriture.message}`)
  }
}

// ─── Mise à jour statut global de l'audit ────────────────────────────────────

/**
 * Met à jour le statut global de la table audits.
 */
export async function mettreAJourStatutAudit(
  auditId: string,
  statut: 'en_cours' | 'termine' | 'erreur'
): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('audits')
    .update({ statut })
    .eq('id', auditId)

  if (error) {
    throw new Error(`[supabase-updates] Erreur mise à jour statut global : ${error.message}`)
  }
}

// ─── Lecture des résultats d'un bloc ─────────────────────────────────────────

/**
 * Lit les résultats d'un bloc déjà calculé depuis audits.resultats.
 */
export async function lireResultatsBloc(
  auditId: string,
  nomBlocResultats: string
): Promise<unknown> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('audits')
    .select('resultats')
    .eq('id', auditId)
    .single()

  if (error || !data) {
    throw new Error(`[supabase-updates] Impossible de lire resultats : ${error?.message}`)
  }

  const resultats = data.resultats as Record<string, unknown>
  return resultats?.[nomBlocResultats] ?? null
}

// ─── Lecture des paramètres complets de la destination ───────────────────────

/**
 * Lit les paramètres complets de la destination associée à l'audit.
 * Fait la jointure avec la table destinations.
 */
export async function lireParamsAudit(auditId: string): Promise<ParamsAudit> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('audits')
    .select(`
      id,
      resultats,
      destinations (
        nom,
        siren,
        code_insee,
        code_postal,
        code_departement,
        population
      )
    `)
    .eq('id', auditId)
    .single()

  if (error || !data) {
    throw new Error(`[supabase-updates] Impossible de lire params audit ${auditId} : ${error?.message}`)
  }

  // Supabase retourne la jointure comme un tableau ou un objet selon la relation
  const destRaw = data.destinations as unknown
  const dest = (Array.isArray(destRaw) ? destRaw[0] : destRaw) as {
    nom: string
    siren: string
    code_insee: string
    code_postal: string
    code_departement: string
    population: number
  } | null

  if (!dest) {
    throw new Error(`[supabase-updates] Destination introuvable pour audit ${auditId}`)
  }

  // Récupérer domaine_ot depuis resultats.schema_digital.domaine_ot_detecte si disponible
  const resultats = (data.resultats as Record<string, unknown>) ?? {}
  const schemaDigital = resultats.schema_digital as Record<string, unknown> | undefined
  const domaine_ot = (schemaDigital?.domaine_ot_detecte as string | null) ?? null

  // ── Diagnostic — params audit chargés (critique pour Bloc 4) ──
  logInfo(auditId, 'Params audit chargés', 'orchestrateur', {
    nom: dest.nom,
    code_insee: dest.code_insee,
    siren: dest.siren,
    domaine_ot: domaine_ot ?? null,
    domaine_ot_source: domaine_ot
      ? 'bloc3_detecte'
      : 'null — Bloc 3 non terminé ou détection échouée',
  })

  return {
    audit_id: auditId,
    nom: dest.nom,
    siren: dest.siren,
    code_insee: dest.code_insee,
    code_postal: dest.code_postal,
    code_departement: dest.code_departement,
    population: dest.population ?? 0,
    domaine_ot,
  }
}

// ─── Lecture des blocs_statuts ────────────────────────────────────────────────

/**
 * Lit les blocs_statuts depuis audits.resultats.
 */
export async function lireBlocsStatuts(auditId: string): Promise<Partial<BlocsStatuts>> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('audits')
    .select('resultats')
    .eq('id', auditId)
    .single()

  if (error || !data) {
    return {}
  }

  const resultats = (data.resultats as Record<string, unknown>) ?? {}
  return (resultats.blocs_statuts as Partial<BlocsStatuts>) ?? {}
}

// ─── Sauvegarde / lecture de la bbox (prefetchée en Segment A) ───────────────

/**
 * Sauvegarde la bbox géographique dans audits.resultats.bbox.
 * Appelé en Segment A juste après lireParamsAudit.
 */
export async function sauvegarderBbox(
  auditId: string,
  bbox: { ne_lat: number; ne_lng: number; sw_lat: number; sw_lng: number } | null
): Promise<void> {
  const supabase = getSupabase()

  const { data: audit } = await supabase
    .from('audits')
    .select('resultats')
    .eq('id', auditId)
    .single()

  const resultatsActuels = (audit?.resultats as Record<string, unknown>) ?? {}

  await supabase
    .from('audits')
    .update({ resultats: { ...resultatsActuels, bbox } })
    .eq('id', auditId)
}

/**
 * Lit la bbox préalablement stockée dans audits.resultats.bbox.
 * Retourne null si absente ou si le prefetch avait échoué.
 */
export async function lireBbox(
  auditId: string
): Promise<{ ne_lat: number; ne_lng: number; sw_lat: number; sw_lng: number } | null> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('audits')
    .select('resultats')
    .eq('id', auditId)
    .single()

  const resultats = data?.resultats as Record<string, unknown> | null
  return (resultats?.bbox as { ne_lat: number; ne_lng: number; sw_lat: number; sw_lng: number } | null) ?? null
}

// ─── Lecture du domaine OT détecté par le Bloc 3 ─────────────────────────────

/**
 * Lit le domaine_ot depuis resultats.schema_digital.domaine_ot_detecte.
 * À appeler après la fin du Bloc 3 pour enrichir les paramètres des blocs suivants.
 */
export async function lireDomaineOT(auditId: string): Promise<string | null> {
  const supabase = getSupabase()

  const { data } = await supabase
    .from('audits')
    .select('resultats')
    .eq('id', auditId)
    .single()

  if (!data) return null

  const resultats = data.resultats as Record<string, unknown>
  const schemaDigital = resultats?.schema_digital as Record<string, unknown> | undefined
  return (schemaDigital?.domaine_ot_detecte as string | null) ?? null
}

// ─── Initialisation blocs_statuts ────────────────────────────────────────────

/**
 * Initialise tous les blocs_statuts à 'en_attente' dans l'audit.
 * N'écrase pas les données existantes dans resultats.
 */
export async function initialiserBlocsStatutsEnBase(
  auditId: string,
  blocsStatuts: BlocsStatuts
): Promise<void> {
  const supabase = getSupabase()

  // Lecture pour merger
  const { data: audit } = await supabase
    .from('audits')
    .select('resultats')
    .eq('id', auditId)
    .single()

  const resultatsActuels = (audit?.resultats as Record<string, unknown>) ?? {}

  const { error } = await supabase
    .from('audits')
    .update({
      resultats: {
        ...resultatsActuels,
        blocs_statuts: blocsStatuts,
      },
    })
    .eq('id', auditId)

  if (error) {
    throw new Error(`[supabase-updates] Erreur init blocs_statuts : ${error.message}`)
  }
}
