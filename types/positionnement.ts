// Types TypeScript pour le Bloc 1 — Positionnement & Notoriété

// ─── POI — DATA Tourisme ─────────────────────────────────────────────────────

// Données brutes renvoyées par le microservice DATA Tourisme
export interface POIBrut {
  id?: string
  nom?: string
  types?: string[]
  // Les données DATA Tourisme sont très variables selon le type de POI
  [key: string]: unknown
}

// POI sélectionné par OpenAI parmi la liste brute
export interface POISelectionne {
  nom: string
  raison: string
}

// ─── Google Maps ─────────────────────────────────────────────────────────────

export interface FicheGoogle {
  nom: string
  note: number
  avis: number
  adresse: string
}

export interface FicheGoogleAbsente {
  absent: true
}

// Fiche Maps d'un POI (peut être présente ou absente)
export type FicheGooglePOI = FicheGoogle | FicheGoogleAbsente

export interface ResultatMaps {
  ot: FicheGoogle | FicheGoogleAbsente
  poi: FicheGooglePOI[]
  score_synthese: number
  cout: {
    dataforseo: {
      nb_appels: number
      cout_unitaire: number
      cout_total: number
    }
  }
}

// ─── Instagram ───────────────────────────────────────────────────────────────

export interface PostInstagram {
  likes: number
  username: string
  timestamp: string
  caption: string
}

export interface ResultatInstagram {
  hashtag: string
  posts_count: number | null
  posts_recents: PostInstagram[]
  ratio_ot_ugc: string
  cout: {
    nb_appels: number
    cout_unitaire: number
    cout_total: number
  }
  erreur?: boolean
}

// ─── OpenAI / Positionnement IA ──────────────────────────────────────────────

export interface AnalysePositionnement {
  axe_principal: string
  mots_cles: string[]
  forces_faiblesses: {
    forces: string[]
    faiblesses: string[]
  }
  paragraphe_gdoc: string
  cout: {
    nb_appels: number
    cout_unitaire: number
    cout_total: number
  }
}

export interface AnalysePositionnementErreur {
  erreur: 'parsing_failed'
  raw: string
  cout: {
    nb_appels: number
    cout_unitaire: number
    cout_total: number
  }
}

// ─── Coûts agrégés du bloc ───────────────────────────────────────────────────

export interface CoutsBloc {
  dataforseo: { nb_appels: number; cout_unitaire: number; cout_total: number }
  apify: { nb_appels: number; cout_unitaire: number; cout_total: number }
  openai: { nb_appels: number; cout_unitaire: number; cout_total: number }
  total_bloc: number
}

// ─── Résultat agrégé du bloc ─────────────────────────────────────────────────

export interface ResultatBlocPositionnement {
  google: ResultatMaps
  instagram: ResultatInstagram
  positionnement: AnalysePositionnement | AnalysePositionnementErreur
  couts_bloc: CoutsBloc
}
