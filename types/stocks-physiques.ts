// Types — Bloc 5 : Stocks physiques (DATA Tourisme + SIRENE)

// ─── Catégories et sous-catégories ────────────────────────────────────────────

export type CategorieStock = 'hebergements' | 'activites' | 'culture' | 'services'

export type SousCategorieHebergement = 'hotels' | 'collectifs' | 'locations' | 'autres'
export type SousCategorieActivite = 'sports_loisirs' | 'visites_tours' | 'experiences'
export type SousCategorieCulture = 'patrimoine' | 'religieux' | 'musees_galeries' | 'spectacle_vivant' | 'nature'
export type SousCategorieService = 'offices_tourisme' | 'agences' | 'location_materiel' | 'transport'

// ─── Établissements bruts (pour déduplication) ────────────────────────────────

export interface EtablissementDT {
  uuid: string                    // nom du fichier sans extension
  nom: string                     // rdfs:label.fr[0]
  categorie: CategorieStock
  sous_categorie: string | null
  telephone: string | null        // hasContact[0].schema:telephone[0] normalisé
  adresse: string | null          // rue + CP
  code_postal: string | null
  lat: number | null
  lng: number | null
}

export interface EtablissementSIRENESimplifie {
  siret: string
  nom: string                     // denominationUniteLegale || nomUsageUniteLegale
  naf: string
  adresse: string | null          // geo_l4 normalisé
  code_postal: string | null
}

// ─── Réponse microservice /stocks ─────────────────────────────────────────────

export interface RetourStocksDATATourisme {
  code_insee: string
  total_etablissements: number
  hebergements: {
    total: number
    hotels: number
    collectifs: number
    locations: number
    autres: number
  }
  activites: {
    total: number
    sports_loisirs: number
    visites_tours: number
    experiences: number
  }
  culture: {
    total: number
    patrimoine: number
    religieux: number
    musees_galeries: number
    spectacle_vivant: number
    nature: number
  }
  services: {
    total: number
    offices_tourisme: number
    agences: number
    location_materiel: number
    transport: number
  }
  etablissements_bruts: EtablissementDT[]
}

// ─── Réponse route SIRENE ─────────────────────────────────────────────────────

export interface RetourStocksSIRENE {
  code_insee: string
  hebergements: { total: number; etablissements: EtablissementSIRENESimplifie[] }
  activites: { total: number; etablissements: EtablissementSIRENESimplifie[] }
  culture: { total: number; etablissements: EtablissementSIRENESimplifie[] }
  services: { total: number; etablissements: EtablissementSIRENESimplifie[] }
  total_global: number
}

// ─── Stocks finaux — sous-type volume + % ─────────────────────────────────────

export interface LigneDetail {
  volume: number    // nombre d'établissements
  pct: number       // % sur le total de la catégorie (arrondi 1 décimale)
}

// ─── Base commune à toutes les catégories ────────────────────────────────────

export interface StocksParCategorie {
  total_unique: number
  dont_data_tourisme: number      // présents dans DT uniquement
  dont_sirene: number             // présents dans SIRENE uniquement
  dont_deux_sources: number       // présents dans les deux
}

// ─── Stocks finaux après déduplication ────────────────────────────────────────

export interface StocksPhysiquesFinaux {
  hebergements: StocksParCategorie & {
    detail: {
      hotels: LigneDetail            // Hotel DT + NAF 55.10Z SIRENE
      campings: LigneDetail          // NAF 55.30Z SIRENE (DT classe en 'autres')
      meubles_locations: LigneDetail // RentalAccommodation DT + NAF 55.20Z SIRENE
      collectifs: LigneDetail        // CollectiveAccommodation DT
      autres: LigneDetail            // autres DT + NAF 55.90Z SIRENE
    }
  }
  activites: StocksParCategorie & {
    detail: {
      sports_loisirs: LigneDetail    // SportsAndLeisurePlace DT + NAF 93.11-93.19 SIRENE
      visites_tours: LigneDetail     // Tour, WalkingTour DT
      experiences: LigneDetail       // ActivityProvider DT + NAF 93.21-93.29 SIRENE
      agences_activites: LigneDetail // NAF 79.90Z SIRENE
    }
  }
  culture: StocksParCategorie & {
    detail: {
      patrimoine: LigneDetail        // Castle, RemarkableBuilding, CulturalSite DT + NAF 91.03Z SIRENE
      religieux: LigneDetail         // Church, Cathedral, Monastery DT
      musees_galeries: LigneDetail   // Museum, Library DT + NAF 91.01-91.02 SIRENE
      spectacle_vivant: LigneDetail  // Theater, Cinema DT + NAF 90.01-90.02 SIRENE
      nature: LigneDetail            // NaturalHeritage, ParkAndGarden, Beach DT + NAF 91.04Z SIRENE
    }
  }
  services: StocksParCategorie & {
    detail: {
      offices_tourisme: LigneDetail  // TouristInformationCenter DT
      agences_voyage: LigneDetail    // IncomingTravelAgency DT + NAF 79.11-79.12 SIRENE
      location_materiel: LigneDetail // EquipmentRental DT
      transport: LigneDetail         // Transport DT
    }
  }
  total_stock_physique: number
  couverture: {
    hebergements: number   // % des établissements SIRENE hébergements trouvés dans DT
    activites: number      // peut dépasser 100% si DT plus riche (patrimoine, associations)
    culture: number
    services: number
    global: number         // couverture globale sur l'ensemble
  }
  ratio_particuliers_hebergement: number  // % NAF 55.20Z (meublés particuliers) / total hébergements SIRENE
  sources_disponibles: {
    data_tourisme: boolean
    sirene: boolean
  }
}

// ─── Réponse OpenAI synthèse ──────────────────────────────────────────────────

export interface SyntheseStocksPhysiques {
  points_forts: string[]
  points_attention: string[]
  indicateurs_cles: {
    label: string
    valeur: string
    interpretation: 'fort' | 'moyen' | 'faible'
  }[]
  synthese_narrative: string
}

// ─── Résultat final du Bloc 5 ─────────────────────────────────────────────────

export interface ResultatBloc5 {
  stocks: StocksPhysiquesFinaux
  synthese: SyntheseStocksPhysiques | null
  meta: {
    cout_total_euros: number
    sources_utilisees: string[]
    erreurs_partielles: string[]  // erreurs non bloquantes
  }
}

// ─── Paramètres d'entrée ──────────────────────────────────────────────────────

export interface ParamsBloc5 {
  destination: string    // ex: "Annecy"
  code_insee: string     // ex: "74010"
  audit_id: string       // UUID Supabase
}
