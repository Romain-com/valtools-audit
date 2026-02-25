// Types — Bloc 5 : Stocks physiques (DATA Tourisme + SIRENE)

// ─── Catégories et sous-catégories ────────────────────────────────────────────

export type CategorieStock = 'hebergements' | 'activites' | 'culture' | 'services'

export type SousCategorieHebergement = 'hotels' | 'collectifs' | 'locations' | 'autres'
export type SousCategorieActivite = 'sports_loisirs' | 'visites_tours' | 'experiences'
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

// ─── Stocks finaux après déduplication ────────────────────────────────────────

export interface StocksParCategorie {
  total_unique: number
  dont_data_tourisme: number      // présents dans DT uniquement
  dont_sirene: number             // présents dans SIRENE uniquement
  dont_deux_sources: number       // présents dans les deux
}

export interface StocksPhysiquesFinaux {
  hebergements: StocksParCategorie & {
    hotels: number
    collectifs: number
    locations: number
    autres: number
  }
  activites: StocksParCategorie & {
    sports_loisirs: number
    visites_tours: number
    experiences: number
  }
  culture: StocksParCategorie
  services: StocksParCategorie & {
    offices_tourisme: number
    agences: number
    location_materiel: number
    transport: number
  }
  total_stock_physique: number
  taux_couverture_dt: number      // % du stock SIRENE présent dans DATA Tourisme (0-100)
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
