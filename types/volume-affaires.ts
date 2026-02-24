// Types — Bloc 2 : Volume d'affaires (taxe de séjour)

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
