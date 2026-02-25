// Orchestrateur — Bloc 2 : Volume d'affaires (taxe de séjour)
// Responsabilité : résoudre l'EPCI, récupérer la taxe, générer la synthèse OpenAI
// + Enrichissement Mélodi : dispatch TS par commune de l'EPCI
// Flux : EPCI → taxe(commune ‖ EPCI) → sélection collecteur → OpenAI
//        → [Mélodi communes EPCI → ajustement coefficients → dispatch TS]
//        → tracking coûts

import { enregistrerCoutsBloc } from '@/lib/tracking-couts'
import type {
  DonneesCollecteur,
  ResultatVolumeAffaires,
  DonneesLogementCommune,
  Coefficients,
  DispatchTS,
  ResultatDispatchTS,
} from '@/types/volume-affaires'

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

// ─── Fonctions de dispatch TS ─────────────────────────────────────────────────

/**
 * Calcule le poids d'hébergement d'une commune (proxy de nuitées/an).
 * Chaque type d'hébergement est multiplié par son coefficient.
 */
function calculerPoidsCommune(
  donnees: DonneesLogementCommune,
  coefficients: Coefficients
): number {
  // Pour les BPE, on somme les établissements "hôtels-like" avec le coeff hôtel
  // et les autres avec les coefficients appropriés
  const nb_tourismes = donnees.residences_tourisme + donnees.villages_vacances
  const nb_autres    = donnees.meubles_classes + donnees.chambres_hotes + donnees.autres_hebergements

  return (
    (donnees.residences_secondaires * coefficients.residence_secondaire)
    + (donnees.hotels               * coefficients.hotel_etablissement)
    + (nb_tourismes                 * coefficients.tourisme_etablissement)
    + (donnees.campings             * coefficients.camping_etablissement)
    + (nb_autres                    * coefficients.autres_etablissement)
  )
}

/**
 * Dispatche le montant TS EPCI entre toutes les communes membres,
 * pondéré par le poids d'hébergement de chaque commune.
 */
function dispatcherTS(
  montant_ts_epci: number,
  communes: DonneesLogementCommune[],
  coefficients: Coefficients
): DispatchTS[] {
  const poids = communes.map((c) => ({
    commune: c,
    poids: calculerPoidsCommune(c, coefficients),
  }))

  const poids_total = poids.reduce((sum, p) => sum + p.poids, 0)

  return poids.map(({ commune: c, poids: p }) => ({
    code_insee: c.code_insee,
    nom: c.nom,
    poids_brut: p,
    part_pct:
      poids_total > 0
        ? Math.round((p / poids_total) * 1000) / 10
        : 0,
    ts_estimee:
      poids_total > 0
        ? Math.round(montant_ts_epci * p / poids_total)
        : 0,
    nuitees_estimees:
      poids_total > 0
        ? Math.round((montant_ts_epci * p / poids_total) / 1.5)
        : 0,
    detail: {
      residences_secondaires: c.residences_secondaires,
      hotels:              c.hotels,
      residences_tourisme: c.residences_tourisme,
      campings:            c.campings,
      villages_vacances:   c.villages_vacances,
      meubles_classes:     c.meubles_classes,
      chambres_hotes:      c.chambres_hotes,
      autres_hebergements: c.autres_hebergements,
    },
  }))
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

/**
 * Point d'entrée du Bloc 2 — Volume d'affaires (taxe de séjour).
 *
 * @param destination        - Nom de la destination (ex: "Annecy")
 * @param siren_commune      - SIREN de la commune (ex: "200063402")
 * @param code_insee         - Code INSEE de la commune (ex: "74010")
 * @param code_departement   - Code département (ex: "74") — pour OpenAI Mélodi
 * @param population_commune - Population de la commune
 * @param audit_id           - UUID de l'audit (pour le tracking des coûts Supabase)
 */
export async function lancerBlocVolumeAffaires(
  destination: string,
  siren_commune: string,
  code_insee: string,
  code_departement: string,
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

    // ─── Étape 5 : enrichissement Mélodi — dispatch TS par commune ──────────
    // Toujours lancé si EPCI disponible. Si commune directe → dispatch trivial (100%).
    let dispatch_ts: ResultatDispatchTS | undefined = undefined

    try {
      // Récupération des communes de l'EPCI (ou juste la commune cible si collecte directe)
      let communes_epci: { code_insee: string; nom: string }[] = []

      if (siren_epci) {
        const epciCommunesData = await appelRoute<{
          communes?: { code_insee: string; nom: string }[]
        }>('/api/blocs/volume-affaires/epci-communes', { siren_epci })

        communes_epci = epciCommunesData.communes ?? []
      }

      // Si pas d'EPCI ou communes introuvables → dispatch trivial sur la commune seule
      if (communes_epci.length === 0) {
        communes_epci = [{ code_insee, nom: destination }]
      }

      // Collecte Mélodi + ajustement coefficients OpenAI
      const melodiData = await appelRoute<{
        donnees?: DonneesLogementCommune[]
        coefficients?: Coefficients
      }>('/api/blocs/volume-affaires/melodi', {
        communes: communes_epci,
        destination,
        departement: code_departement,
        montant_ts: collecteur.montant_taxe_euros,
      })

      const donnees_melodi = melodiData.donnees ?? []
      const coefficients   = melodiData.coefficients ?? {
        residence_secondaire: 30,
        hotel_etablissement: 2000,
        tourisme_etablissement: 1500,
        camping_etablissement: 600,
        autres_etablissement: 800,
        source: 'fixes' as const,
        profil_destination: 'mixte',
        justification: null,
      }

      if (donnees_melodi.length > 0) {
        const mode: ResultatDispatchTS['mode'] = siren_epci
          ? 'dispatch_epci'
          : 'reconstitution_totale'

        const communes_dispatche = dispatcherTS(
          collecteur.montant_taxe_euros,
          donnees_melodi,
          coefficients
        )

        // Commune cible dans le dispatch (peut être absente si données Mélodi incomplètes)
        const commune_cible =
          communes_dispatche.find((c) => c.code_insee === code_insee)
          ?? communes_dispatche[0]

        dispatch_ts = {
          mode,
          montant_ts_source: collecteur.montant_taxe_euros,
          communes: communes_dispatche,
          commune_cible,
          coefficients_utilises: coefficients,
          // comparaison_bloc5 sera ajoutée par l'orchestrateur principal si Bloc 5 disponible
        }
      }
    } catch (errMelodi) {
      // L'enrichissement Mélodi est optionnel — une erreur ne bloque pas le bloc
      console.warn('[Bloc 2] Enrichissement Mélodi ignoré :', errMelodi)
    }

    // ─── Étape 6 : tracking des coûts (fire & forget) ──────────────────────
    // OpenAI ×2 si Mélodi OK (synthèse + coefficients), ×1 sinon
    // Mélodi (INSEE) est gratuit
    const nb_openai = dispatch_ts ? 2 : 1
    const cout_total = nb_openai * 0.001

    enregistrerCoutsBloc(audit_id, 'volume_affaires', {
      openai: { nb_appels: nb_openai, cout_unitaire: 0.001, cout_total },
      melodi_rp:  { nb_appels: 0, cout_unitaire: 0, cout_total: 0 },
      melodi_bpe: { nb_appels: 0, cout_unitaire: 0, cout_total: 0 },
      total_bloc: cout_total,
    })

    // ─── Étape 7 : construction du résultat ────────────────────────────────
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
        cout_total_euros: cout_total,
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

    // Enrichissement Mélodi si disponible
    if (dispatch_ts) {
      resultat.dispatch_ts = dispatch_ts
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
