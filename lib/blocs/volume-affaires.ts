// Orchestrateur — Bloc 2 : Volume d'affaires (taxe de séjour)
// Responsabilité : résoudre l'EPCI, récupérer la taxe, générer la synthèse OpenAI
// Flux : EPCI → taxe(commune ‖ EPCI) → sélection collecteur → OpenAI → tracking coûts

import { enregistrerCoutsBloc } from '@/lib/tracking-couts'
import type { DonneesCollecteur, ResultatVolumeAffaires } from '@/types/volume-affaires'

// URL de base — à adapter selon l'environnement
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Taux moyen national utilisé pour l'estimation des nuitées
const TAUX_MOYEN_NUIT = 1.5

/**
 * Appelle une route API interne avec un body JSON.
 * Pas de cache — les données d'audit doivent toujours être fraîches.
 */
async function appelRoute<T>(chemin: string, body: object): Promise<T> {
  const reponse = await fetch(`${BASE_URL}${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  })

  if (!reponse.ok) {
    throw new Error(`[${chemin}] Erreur HTTP ${reponse.status}`)
  }

  return reponse.json() as Promise<T>
}

/**
 * Point d'entrée du Bloc 2 — Volume d'affaires (taxe de séjour).
 *
 * @param destination      - Nom de la destination (ex: "Annecy")
 * @param siren_commune    - SIREN de la commune (ex: "200063402")
 * @param code_insee       - Code INSEE de la commune (ex: "74010")
 * @param population_commune - Population de la commune
 * @param audit_id         - UUID de l'audit (pour le tracking des coûts Supabase)
 */
export async function lancerBlocVolumeAffaires(
  destination: string,
  siren_commune: string,
  code_insee: string,
  population_commune: number,
  audit_id: string
): Promise<ResultatVolumeAffaires> {

  try {
    // ─── Étape 1 : résolution de l'EPCI ────────────────────────────────────
    const epciData = await appelRoute<{
      siren_epci: string | null
      nom_epci?: string
      type_epci?: string
      population_epci?: number
    }>('/api/blocs/volume-affaires/epci', { code_insee })

    const siren_epci = epciData.siren_epci ?? null

    // ─── Étape 2 : taxes en parallèle (commune + EPCI si disponible) ───────
    const [taxeCommune, taxeEpci] = await Promise.all([
      appelRoute<{
        siren: string
        lbudg: string
        montant_taxe_euros: number
        annee_donnees: number
        taxe_non_instituee: boolean
        dataset_source: string
      }>('/api/blocs/volume-affaires/taxe', {
        siren: siren_commune,
        type_collecteur: 'commune',
      }),
      siren_epci
        ? appelRoute<{
            siren: string
            lbudg: string
            montant_taxe_euros: number
            annee_donnees: number
            taxe_non_instituee: boolean
            dataset_source: string
          }>('/api/blocs/volume-affaires/taxe', {
            siren: siren_epci,
            type_collecteur: 'epci',
          })
        : Promise.resolve(null),
    ])

    // ─── Étape 3 : sélection du collecteur ─────────────────────────────────
    // Priorité : commune si elle a des données, sinon EPCI, sinon taxe non instituée

    let collecteur: DonneesCollecteur
    let dataset_source = ''

    if (taxeCommune.montant_taxe_euros > 0) {
      // La commune collecte directement
      collecteur = {
        siren: siren_commune,
        nom: taxeCommune.lbudg || destination,
        type_collecteur: 'commune',
        annee_donnees: taxeCommune.annee_donnees,
        montant_taxe_euros: taxeCommune.montant_taxe_euros,
        nuitees_estimees: Math.round(taxeCommune.montant_taxe_euros / TAUX_MOYEN_NUIT),
      }
      dataset_source = taxeCommune.dataset_source
    } else if (taxeEpci && taxeEpci.montant_taxe_euros > 0) {
      // La taxe est collectée par l'EPCI
      collecteur = {
        siren: siren_epci!,
        nom: epciData.nom_epci ?? taxeEpci.lbudg ?? 'EPCI inconnu',
        type_collecteur: 'epci',
        type_epci: epciData.type_epci,
        population_epci: epciData.population_epci,
        annee_donnees: taxeEpci.annee_donnees,
        montant_taxe_euros: taxeEpci.montant_taxe_euros,
        nuitees_estimees: Math.round(taxeEpci.montant_taxe_euros / TAUX_MOYEN_NUIT),
      }
      dataset_source = taxeEpci.dataset_source
    } else {
      // Aucune taxe de séjour trouvée — retour dégradé sans appel OpenAI
      return {
        collecteur: {
          siren: siren_commune,
          nom: destination,
          type_collecteur: 'commune',
          annee_donnees: taxeCommune.annee_donnees,
          montant_taxe_euros: 0,
          nuitees_estimees: 0,
        },
        taxe_non_instituee: true,
        openai: {
          synthese_volume: '',
          indicateurs_cles: [],
        },
        meta: {
          annee_donnees: taxeCommune.annee_donnees,
          taux_moyen_utilise: TAUX_MOYEN_NUIT,
          dataset_source: taxeCommune.dataset_source,
          cout_total_euros: 0,
        },
      }
    }

    // ─── Étape 4 : analyse OpenAI ───────────────────────────────────────────
    const est_epci = collecteur.type_collecteur === 'epci'

    const openaiData = await appelRoute<{
      synthese_volume?: string
      indicateurs_cles?: string[]
      part_commune?: {
        pourcentage: number
        montant_euros: number
        raisonnement: string
      }
    }>('/api/blocs/volume-affaires/openai', {
      destination,
      collecteur,
      est_epci,
      population_commune,
    })

    // ─── Étape 5 : tracking des coûts (fire & forget) ──────────────────────
    // OpenAI uniquement — data.economie.gouv.fr est gratuit
    enregistrerCoutsBloc(audit_id, 'volume_affaires', {
      openai: { nb_appels: 1, cout_unitaire: 0.001, cout_total: 0.001 },
      total_bloc: 0.001,
    })

    // ─── Étape 6 : construction du résultat ────────────────────────────────
    const resultat: ResultatVolumeAffaires = {
      collecteur,
      taxe_non_instituee: false,
      openai: {
        synthese_volume: openaiData.synthese_volume ?? '',
        indicateurs_cles: openaiData.indicateurs_cles ?? [],
      },
      meta: {
        annee_donnees: collecteur.annee_donnees,
        taux_moyen_utilise: TAUX_MOYEN_NUIT,
        dataset_source,
        cout_total_euros: 0.001,
      },
    }

    // Ajout de la part commune estimée uniquement si collecteur = EPCI
    if (est_epci && openaiData.part_commune) {
      resultat.part_commune_estimee = {
        pourcentage: openaiData.part_commune.pourcentage,
        montant_euros: openaiData.part_commune.montant_euros,
        raisonnement: openaiData.part_commune.raisonnement,
      }
    }

    return resultat

  } catch (err: unknown) {
    // L'orchestrateur ne throw jamais — retour dégradé en cas d'erreur inattendue
    console.error('[Bloc 2] Erreur inattendue :', err)
    return {
      collecteur: {
        siren: siren_commune,
        nom: destination,
        type_collecteur: 'commune',
        annee_donnees: 0,
        montant_taxe_euros: 0,
        nuitees_estimees: 0,
      },
      taxe_non_instituee: true,
      openai: {
        synthese_volume: '',
        indicateurs_cles: [],
      },
      meta: {
        annee_donnees: 0,
        taux_moyen_utilise: TAUX_MOYEN_NUIT,
        dataset_source: '',
        cout_total_euros: 0,
      },
    }
  }
}
