// Types — Bloc 2 : Volume d'affaires (taxe de séjour)
// Inclut les types pour l'enrichissement Mélodi (dispatch TS par commune)

// ─── Types existants ──────────────────────────────────────────────────────────

export interface DonneesCollecteur {
  siren: string
  nom: string
  type_collecteur: 'commune' | 'epci'
  type_epci?: string         // CA, CC, MET...
  population_epci?: number
  annee_donnees: number
  montant_taxe_euros: number // somme comptes 731721 + 731722
  nuitees_estimees: number   // montant ÷ 1.50, arrondi entier
}

export interface ResultatVolumeAffaires {
  collecteur: DonneesCollecteur
  part_commune_estimee?: {
    pourcentage: number
    montant_euros: number
    raisonnement: string
  }
  taxe_non_instituee: boolean
  dispatch_ts?: ResultatDispatchTS   // enrichissement Mélodi (optionnel)
  openai: {
    synthese_volume: string      // 80-100 mots pour GDoc
    indicateurs_cles: string[]   // exactement 3 chiffres clés
  }
  meta: {
    annee_donnees: number
    taux_moyen_utilise: number   // toujours 1.50
    dataset_source: string
    cout_total_euros: number
  }
}

// ─── Types Mélodi — dispatch TS par commune ───────────────────────────────────

/** Données logement par commune — issues de l'API Mélodi INSEE */
export interface DonneesLogementCommune {
  code_insee: string
  nom: string
  residences_secondaires: number    // RP 2022 — compte DW_SEC_DW_OCC
  hotels: number                    // BPE D701 — hôtels homologués
  campings: number                  // BPE D702 — campings homologués
  residences_tourisme: number       // BPE D703 — résidences de tourisme
  villages_vacances: number         // BPE D705 — villages vacances
  meubles_classes: number           // BPE D710 — meublés de tourisme classés
  chambres_hotes: number            // BPE D711 — chambres d'hôtes
  autres_hebergements: number       // BPE autres établissements D7 (hors codes ci-dessus)
  source_rs: 'melodi_rp' | 'absent'
  source_bpe: 'melodi_bpe' | 'absent'
}

/** Coefficients de pondération (nuitées/an) — fixes ou ajustés par OpenAI */
export interface Coefficients {
  residence_secondaire: number      // nuitées/an par résidence secondaire
  hotel_etablissement: number       // nuitées/an par hôtel
  tourisme_etablissement: number    // nuitées/an par résidence de tourisme
  camping_etablissement: number     // nuitées/an par camping
  autres_etablissement: number      // nuitées/an par autre hébergement
  source: 'fixes' | 'openai_ajuste'
  profil_destination: string        // ex: "station_ski", "bord_lac", "ville"
  justification: string | null      // explication OpenAI en 1 phrase
}

/** Résultat du dispatch TS pour une commune */
export interface DispatchTS {
  code_insee: string
  nom: string
  poids_brut: number      // nuitées estimées brutes (pré-normalisation)
  part_pct: number        // % du total EPCI (arrondi à 1 décimale)
  ts_estimee: number      // € estimés pour cette commune
  nuitees_estimees: number
  detail: {
    residences_secondaires: number
    hotels: number
    residences_tourisme: number
    campings: number
    villages_vacances: number
    meubles_classes: number
    chambres_hotes: number
    autres_hebergements: number
  }
}

/** Résultat complet du dispatch TS — retourné par l'enrichissement Mélodi */
export interface ResultatDispatchTS {
  mode: 'dispatch_epci' | 'reconstitution_totale'
  montant_ts_source: number          // montant TS connu (EPCI ou 0 si reconstitution)
  communes: DispatchTS[]             // toutes les communes de l'EPCI
  commune_cible: DispatchTS          // la commune auditée
  coefficients_utilises: Coefficients
  comparaison_bloc5?: {
    hebergements_bloc5: number       // total établissements Bloc 5 pour la commune cible
    hebergements_melodi: number      // total BPE Mélodi pour la commune cible
    ecart_pct: number                // % d'écart entre les deux sources
  }
}
