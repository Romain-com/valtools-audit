// Types et helpers — statuts des blocs de l'orchestrateur principal
// Responsabilité : définir les états possibles de chaque bloc et les helpers de transition

// ─── Statuts possibles d'un bloc ─────────────────────────────────────────────

export type StatutBloc =
  | 'en_attente'
  | 'en_cours'
  | 'termine'
  | 'en_attente_validation'
  | 'erreur'

// ─── Structure blocs_statuts stockée dans audits.resultats ───────────────────

export interface BlocsStatuts {
  bloc1: StatutBloc  // Positionnement & Notoriété
  bloc2: StatutBloc  // Volume d'affaires
  bloc3: StatutBloc  // Schéma digital & Santé technique
  bloc4: StatutBloc  // Visibilité SEO & Gap
  bloc5: StatutBloc  // Stocks physiques
  bloc6: StatutBloc  // Stock en ligne
  bloc7: StatutBloc  // Concurrents
}

// ─── Paramètres communs passés à tous les wrappers ───────────────────────────

export interface ParamsAudit {
  audit_id: string
  nom: string            // ex: "Chamonix-Mont-Blanc"
  code_insee: string     // ex: "74056"
  siren: string          // ex: "210600788"
  code_postal: string    // ex: "74400"
  code_departement: string  // ex: "74"
  population: number     // nécessaire pour Bloc 7 contexte
  domaine_ot: string | null  // disponible après Bloc 3 seulement
}

// ─── Interface standard attendue par l'orchestrateur ─────────────────────────

export interface ResultatBloc {
  resultats: Record<string, unknown>  // données à stocker dans audits.resultats
  couts: Record<string, unknown>      // coûts à merger dans audits.couts_api
}

// ─── État initial — tous les blocs en attente ────────────────────────────────

export function initialiserBlocsStatuts(): BlocsStatuts {
  return {
    bloc1: 'en_attente',
    bloc2: 'en_attente',
    bloc3: 'en_attente',
    bloc4: 'en_attente',
    bloc5: 'en_attente',
    bloc6: 'en_attente',
    bloc7: 'en_attente',
  }
}

// ─── Noms des clés dans audits.resultats ─────────────────────────────────────

export const BLOCS_RESULTATS_KEYS: Record<keyof BlocsStatuts, string> = {
  bloc1: 'positionnement',
  bloc2: 'volume_affaires',
  bloc3: 'schema_digital',
  bloc4: 'visibilite_seo',
  bloc5: 'stocks_physiques',
  bloc6: 'stock_en_ligne',
  bloc7: 'concurrents',
}
