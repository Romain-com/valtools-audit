// Types TypeScript pour le Bloc 1 — Positionnement & Notoriété

// ─── Google Maps ────────────────────────────────────────────────────────────

export interface FicheGoogle {
  nom: string
  note: number
  avis: number
  adresse: string
}

export interface FicheGoogleAbsente {
  absent: true
}

export interface CoutAppel {
  nb_appels: number
  cout_unitaire: number
  cout_total: number
}

export interface ResultatMaps {
  destination: FicheGoogle
  ot: FicheGoogle | FicheGoogleAbsente
  score_synthese: number
  cout: CoutAppel
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
  cout: CoutAppel
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
  cout: CoutAppel
}

export interface AnalysePositionnementErreur {
  erreur: 'parsing_failed'
  raw: string
  cout: CoutAppel
}

// ─── Résultat agrégé du bloc ─────────────────────────────────────────────────

export interface ResultatBlocPositionnement {
  google: ResultatMaps
  instagram: ResultatInstagram
  positionnement: AnalysePositionnement | AnalysePositionnementErreur
  cout_total_bloc: number
}
