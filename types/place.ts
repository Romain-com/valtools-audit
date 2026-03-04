// Types pour Vue 3 — Analyse d'un lieu touristique
// Indépendant de la Vue 1 (écosystème destination)

export interface CommuneDetection {
  commune: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string // courte explication de GPT
}

export interface PlaceSerpResult {
  domain: string
  url: string
  title: string
  description: string
  position: number
  actorType: 'LIEU_OFFICIEL' | 'COMMUNE_OT' | 'AGGREGATEUR' | 'MEDIA' | 'AUTRE'
}

export interface PlaceGMB {
  exists: boolean
  name: string | null
  rating: number | null
  reviewCount: number | null
  isClaimed: boolean | null
  address: string | null
  phone: string | null
}

export interface CommuneSerpResult {
  domain: string
  url: string
  title: string
  description: string
  position: number
  mentionsPlace: boolean // true si titre ou description mentionne le nom du lieu
}

export interface PlaceHaloscanData {
  domain: string | null
  totalTraffic: number | null
  uniqueKeywords: number | null
  totalTop10: number | null
  found: boolean
}

export interface PlaceDiagnostic {
  placeExists: boolean          // a un site ou une fiche GMB
  communeMentionsPlace: boolean // au moins 1 résultat commune mentionne le lieu
  placeVisibilityVsCommune: 'SUPERIEURE' | 'EQUIVALENTE' | 'INFERIEURE' | 'INEXISTANTE'
  headline: string              // phrase choc GPT
  recommendations: string[]     // 2-3 constats actionnables GPT
}

export interface PlaceData {
  placeName: string
  commune: string
  placeSerp: PlaceSerpResult[]
  placeGMB: PlaceGMB
  communeSerp: CommuneSerpResult[]
  placeHaloscan: PlaceHaloscanData | null
  communeHaloscan: PlaceHaloscanData | null
  diagnostic: PlaceDiagnostic
}
