// ============================================
// Types partagés — Valtools-audit
// ============================================

// ---- Inputs communs ----

export interface AuditInput {
  destination: string;
  codePostal?: string;
  codeInsee?: string;
}

// ---- Module 1 — Notoriété ----

export interface NotorieteInput {
  destination: string;
  codePostal: string;
  codeInsee: string;
}

export interface NotorieteResult {
  positionnement: {
    label: string;
    arguments: string[];
    ton: string;
    source: "datatourisme" | "dataforseo_fallback";
  };
  eReputation: {
    note: number | null;
    nbAvis: number | null;
    sentiment: number | null;
    synthese: string;
  };
  social: {
    volumeHashtag: number | null;
    followersOT: number | null;
    ratioHype: number | null;
    diagnosticCalcule: string;
    phraseFinalRapport: string;
  };
}

// ---- Module 2 — Volume d'Affaires ----

export interface VolumeAffairesInput {
  destination: string;
  codeInsee: string;
  population: number;
}

export interface VolumeAffairesResult {
  taxeTotale: number;
  compte7311: number;
  compte7321: number;
  volumeAffaires: number;
  nuiteesEstimees: number;
  ratioPressionTouristique: number;
  source: "commune" | "epci" | "commune+epci" | "non_disponible";
  anneeReference: number;
  diagnostic: string;
  niveau: "puissant" | "moyen" | "sous-exploite" | "non_disponible";
}

// ---- Module 3 — Schéma Digital ----

export interface SchemaDigitalInput {
  destination: string;
}

export interface SchemaDigitalOutput {
  urlOT: string | null;
  urlMairie: string | null;
  classementDigital: Array<{
    url: string;
    categorie: string;
    position: number;
  }>;
  alertes: string[];
  pagespeed: {
    score: number;
    lcp: number;
    cls: number;
    inp: number;
    niveau: string;
    diagnostic: string;
  };
}

// ---- Module 4 — Audit SEO ----

export interface AuditSeoInput {
  destination: string;
  urlOT: string;
}

export interface AuditSeoOutput {
  motsCles: Array<{
    kw: string;
    volume: number;
    categorie: string;
  }>;
  visibiliteOT: Array<{
    requete: string;
    position: number | null;
    statut: string;
  }>;
  paa: string[];
  synthese: {
    opportunite: string;
    intention: string;
    paaRecommendation: string;
  };
}

// ---- Module 5 — Stocks Physiques ----

export interface StocksPhysiquesInput {
  destination: string;
  codeInsee: string;
}

export interface StocksPhysiquesOutput {
  hebergements: {
    total: number;
    capacite: number;
    detail: Record<string, number>;
  };
  activites: {
    total: number;
    detail: Record<string, number>;
  };
  restauration: {
    total: number;
    detail: Record<string, number>;
  };
  profilDominant: string;
  analyse: string;
}

// ---- Module 6 — Stocks Commerciaux ----

export interface StocksCommerciauxInput {
  destination: string;
  stocksPhysiques: StocksPhysiquesOutput;
}

export interface StocksCommerciauxOutput {
  hebergement: { airbnb: number; booking: number; abritel: number };
  activites: { tripadvisor: number; getyourguide: number };
  restauration: { thefork: number; michelin: number };
  digitalCoverage: { hebergement: number; activites: number };
  alertes: string[];
  diagnostic: string;
}

// ---- Module 7 — Benchmark Concurrentiel ----

export interface BenchmarkInput {
  destination: string;
  codeInsee: string;
  population: number;
  departement: string;
}

export interface BenchmarkOutput {
  profil: {
    typologieGeo: string;
    population: number;
    departement: string;
  };
  concurrentsDirects: Array<{
    nom: string;
    population: number;
    departement: string;
  }>;
  concurrentsIndirects: Array<{
    nom: string;
    population: number;
    departement: string;
  }>;
  auditFlash: Array<{
    nom: string;
    scoreSocial: number;
    scoreOffre: number;
  }>;
  classement: {
    social: number;
    offre: number;
    statut: string;
  };
  positionnement: string;
  recommandation: string;
}

// ---- Types Supabase ----

export interface AuditRecord {
  id: string;
  destination: string;
  code_insee: string | null;
  created_at: string;
  status: "pending" | "running" | "completed" | "error";
  completed_at: string | null;
}

export interface AuditResultRecord {
  id: string;
  audit_id: string;
  module: string;
  data: unknown;
  error: string | null;
  created_at: string;
}
