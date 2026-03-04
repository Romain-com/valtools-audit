// Types TypeScript partagés — Vue 1 : Écosystème digital d'une destination

export type SiteCategory =
  | 'OT'
  | 'STATION'
  | 'INSTITUTIONNEL'
  | 'PARC'
  | 'AUTRE_OFFICIEL';

export type ClassificationConfidence = 'high' | 'medium' | 'low';

export interface DetectedSite {
  domain: string;
  url: string;
  title: string;
  description: string;
  serpPosition: number | null;
}

export interface ClassifiedSite extends DetectedSite {
  isOfficial: boolean;
  category: SiteCategory | null;
  confidence: ClassificationConfidence;
  manuallyAdded?: boolean;
}

export interface EnrichedSite extends ClassifiedSite {
  totalTraffic: number | null;
  uniqueKeywords: number | null;
  totalTop10: number | null;
  totalTop3: number | null;
  authorityScore: number;
  haloscanFound: boolean;
}

// Données retournées par Haloscan pour un domaine
export interface HaloscanData {
  domain: string;
  totalTraffic: number | null;
  uniqueKeywords: number | null;
  totalTop10: number | null;
  totalTop3: number | null;
  haloscanFound: boolean;
}
