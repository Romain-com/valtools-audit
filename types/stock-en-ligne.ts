// Types TypeScript — Bloc 6 : Stock commercialisé en ligne (OTA + site OT)
// Sources : Airbnb (Playwright), Booking (Playwright), Viator (Playwright), site OT (Playwright), OpenAI

// ─── Paramètres d'entrée ──────────────────────────────────────────────────────

export interface ParamsBloc6 {
  destination: string           // ex: "Annecy"
  code_insee: string            // ex: "74010"
  domaine_ot: string            // ex: "lac-annecy.com"
  audit_id: string
  bbox?: BoundingBox | null     // prefetchée en Segment A — si null, appel microservice en fallback
}

// ─── Bounding Box ─────────────────────────────────────────────────────────────

export interface BoundingBox {
  ne_lat: number   // nord-est latitude
  ne_lng: number   // nord-est longitude
  sw_lat: number   // sud-ouest latitude
  sw_lng: number   // sud-ouest longitude
}

// ─── Site OT ──────────────────────────────────────────────────────────────────

export type TypeSection = 'reservable_direct' | 'lien_ota' | 'listing_seul' | 'absent'

export interface AnalyseSectionOT {
  nb_fiches: number
  est_reservable_direct: boolean
  liens_ota: string[]    // ex: ['booking', 'airbnb']
  type: TypeSection
}

export interface ResultatSiteOT {
  domaine: string
  url_hebergements: string | null
  url_activites: string | null
  hebergements: AnalyseSectionOT
  activites: AnalyseSectionOT
  moteur_resa_detecte: string | null    // 'bokun' | 'regiondo' | 'fareharbor' | 'checkfront' | 'rezdy' | null
  duree_ms: number
  erreur?: string
}

// ─── Airbnb ───────────────────────────────────────────────────────────────────

export interface ResultatAirbnb {
  total_annonces: number
  nb_requetes: number
  nb_zones: number
  bbox_utilisee: BoundingBox | null  // null si le microservice bbox était indisponible (mode nom de ville)
  duree_ms: number
  erreur?: string
}

// ─── Booking ──────────────────────────────────────────────────────────────────

export interface DetailBooking {
  hotels: number
  apparts: number
  campings: number
  bb: number
  villas: number
}

export interface ResultatBooking {
  total_proprietes: number
  detail: DetailBooking
  duree_ms: number
  erreur?: string
}

// ─── Viator ───────────────────────────────────────────────────────────────────

export interface ResultatViator {
  total_activites: number
  url_utilisee: string
  slug_detecte: string | null
  duree_ms: number
  erreur?: string
}

// ─── Indicateurs de croisement ────────────────────────────────────────────────

export interface IndicateursBloc6 {
  // Taux calculés (null si données manquantes)
  taux_dependance_ota: number | null           // (airbnb + booking) / bloc5.hebergements.total_unique
  taux_reservable_direct: number | null        // site_ot.hebergements.nb_fiches / (airbnb + booking)
  taux_visibilite_activites: number | null     // viator / bloc5.activites.total_unique

  // Totaux bruts
  total_ota_hebergements: number               // airbnb + booking
  total_ot_hebergements: number                // fiches hébergements sur le site OT
  total_ot_activites: number                   // fiches activités sur le site OT
  total_viator: number                         // activités sur Viator

  // Classification site OT
  site_ot_type_hebergements: TypeSection
  site_ot_type_activites: TypeSection
  site_ot_ota_detectees: string[]              // OTA détectées sur le site OT
  moteur_resa_detecte: string | null
}

// ─── Synthèse OpenAI ──────────────────────────────────────────────────────────

export interface PointCle {
  label: string
  valeur: string
  niveau: 'bon' | 'moyen' | 'critique'
}

export interface SyntheseBloc6 {
  diagnostic: string
  points_cles: PointCle[]
  message_ot: string          // message percutant à destination de l'OT
  recommandations: string[]
}

// ─── Résultat final du bloc ───────────────────────────────────────────────────

export interface ResultatBloc6 {
  site_ot: ResultatSiteOT | null
  airbnb: ResultatAirbnb | null
  booking: ResultatBooking | null
  viator: ResultatViator | null
  indicateurs: IndicateursBloc6
  synthese: SyntheseBloc6 | null
  couts: {
    openai: number
    scraping: number
  }
  meta: {
    erreurs_partielles: string[]
    duree_totale_ms: number
  }
}
