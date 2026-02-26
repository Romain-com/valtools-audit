// Orchestrateur — Bloc 7 Phase B : Synthèse comparative
// Responsabilité : construire le tableau comparatif et générer la synthèse OpenAI
// Déclenché après validation utilisateur des concurrents (suppression éventuelle)
// Enrichissement : insight_gap depuis Haloscan siteCompetitors (missed_keywords > 1000)
// Input : phase_a + liste des concurrents conservés + métriques de la destination cible

import { API_COSTS } from '@/lib/api-costs'
import { enregistrerCoutsBloc } from '@/lib/tracking-couts'
import { executerSyntheseConcurrents } from '@/app/api/blocs/concurrents/synthese/logic'
import type {
  ParamsPhaseB,
  TableauComparatif,
  SyntheseConcurrents,
  ResultatBlocConcurrents,
  CoutsBlocConcurrents,
} from '@/types/concurrents'

// ─── Point d'entrée Phase B ───────────────────────────────────────────────────

export async function lancerPhaseBConcurrents(
  params: ParamsPhaseB
): Promise<ResultatBlocConcurrents> {
  const { audit_id, destination, phase_a, concurrents_valides, metriques_destination } = params

  // ─── Construction du tableau comparatif ──────────────────────────────────────
  // Croiser les concurrents validés avec les métriques collectées en Phase A

  const tableau_comparatif: TableauComparatif = {
    destination_cible: {
      nom: destination,
      ...metriques_destination,
    },
    concurrents: concurrents_valides.map((c) => {
      // Retrouver les métriques depuis la Phase A
      const avecMetriques = phase_a.concurrents.find((cm) => cm.nom === c.nom)
      return {
        nom: c.nom,
        total_keywords: avecMetriques?.metriques.total_keywords ?? 0,
        total_traffic: avecMetriques?.metriques.total_traffic ?? 0,
        note_google: avecMetriques?.metriques.note_google ?? null,
        nb_avis_google: avecMetriques?.metriques.nb_avis_google ?? null,
        position_serp_requete_principale:
          avecMetriques?.metriques.position_serp_requete_principale ?? null,
      }
    }),
  }

  // ─── Insight gap depuis Haloscan siteCompetitors ──────────────────────────────
  // Transmettre à OpenAI uniquement si missed_keywords > 1000 (en dessous c'est du bruit)

  const insight_gap_lignes = concurrents_valides
    .map((c) => {
      const avecMatch = phase_a.concurrents.find((cm) => cm.nom === c.nom)
      return avecMatch?.haloscan_match
    })
    .filter((match): match is NonNullable<typeof match> => !!match && match.missed_keywords > 1000)
    .map((match) => {
      const nomConcurrent = phase_a.concurrents.find(
        (c) => c.haloscan_match?.root_domain === match.root_domain
      )?.nom ?? match.root_domain
      return `${nomConcurrent} : ${match.missed_keywords.toLocaleString('fr-FR')} keywords non couverts par ${destination}`
    })

  const insight_gap =
    insight_gap_lignes.length > 0 ? insight_gap_lignes.join('\n') : undefined

  // ─── Synthèse OpenAI ──────────────────────────────────────────────────────────

  let synthese: SyntheseConcurrents
  try {
    synthese = await executerSyntheseConcurrents({
      destination,
      tableau_comparatif,
      insight_gap,
    }) as SyntheseConcurrents
  } catch (err) {
    throw new Error(`[Phase B Concurrents] Synthèse OpenAI échouée : ${err}`)
  }

  // ─── Calcul des coûts finaux (Phase A + Phase B) ──────────────────────────────

  const coutsPhaseA = phase_a.couts
  const couts: CoutsBlocConcurrents = {
    openai_identification: coutsPhaseA.openai_identification,
    haloscan: coutsPhaseA.haloscan,
    haloscan_positions: coutsPhaseA.haloscan_positions,
    haloscan_competitors: coutsPhaseA.haloscan_competitors,
    dataforseo_ranked: coutsPhaseA.dataforseo_ranked,
    dataforseo_maps: coutsPhaseA.dataforseo_maps,
    dataforseo_serp_validation: coutsPhaseA.dataforseo_serp_validation,
    openai_synthese: API_COSTS.openai_gpt5_mini,
    total_bloc:
      coutsPhaseA.openai_identification +
      coutsPhaseA.haloscan +
      coutsPhaseA.haloscan_positions +
      coutsPhaseA.haloscan_competitors +
      coutsPhaseA.dataforseo_ranked +
      coutsPhaseA.dataforseo_maps +
      coutsPhaseA.dataforseo_serp_validation +
      API_COSTS.openai_gpt5_mini,
  }

  // ─── Tracking des coûts finaux (fire & forget) ────────────────────────────────

  enregistrerCoutsBloc(audit_id, 'concurrents', couts)

  return {
    phase_a,
    concurrents_valides,
    tableau_comparatif,
    synthese,
    statut: 'termine',
    couts,
  }
}
