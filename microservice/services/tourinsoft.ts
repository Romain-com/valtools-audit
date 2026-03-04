// Service Tourinsoft — chargement en mémoire des données ANMSM
// Lit les fichiers JSON produits par scripts/sync-tourinsoft.ts
// et indexe les objets par code postal pour une interrogation rapide.

import fs from 'fs'
import path from 'path'

const CACHE_DIR = path.join(__dirname, '../cache/tourinsoft')

// ─── Types (miroirs du script de sync) ───────────────────────────────────────

export interface StationTourinsoft {
  id: string
  nom: string
  lat: number
  lng: number
  cp_ot: string
  alt_bas: number
  alt_haut: number
  vtt: boolean
  nom_ot: string
  adresse_ot: string
  accroche: string
  desc_hiver: string
  desc_ete: string
  desc_act_hiver: string
  desc_act_ete: string
  desc_heb: string
  desc_res: string
}

export interface HebergementTourinsoft {
  id: string
  nom: string
  type: string
  commune: string
  code_postal: string
  station_id: string
  lits: number
  lat: number
  lng: number
}

export interface ActiviteTourinsoft {
  id: string
  nom: string
  type: string
  commune: string
  code_postal: string
  station_id: string
  lat: number
  lng: number
}

export interface CommerceTourinsoft {
  id: string
  nom: string
  type: string
  commune: string
  code_postal: string
  station_id: string
  lat: number
  lng: number
}

export interface SejourTourinsoft {
  id: string
  nom: string
  station_id: string
  lat: number
  lng: number
  accroche: string
  description: string
}

// ─── Index en RAM ─────────────────────────────────────────────────────────────

// Stations : indexées par id ET par code postal de l'OT
const stationsParId    = new Map<string, StationTourinsoft>()
const stationsParCp    = new Map<string, StationTourinsoft[]>()

// Hébergements/activités/commerces : indexés par code postal
const hebergementsParCp = new Map<string, HebergementTourinsoft[]>()
const activitesParCp    = new Map<string, ActiviteTourinsoft[]>()
const commercesParCp    = new Map<string, CommerceTourinsoft[]>()

// Séjours : liste globale (43 items seulement)
let sejours: SejourTourinsoft[] = []

let indexPret = false

// ─── Chargement depuis le cache disque ────────────────────────────────────────

function chargerFichier<T>(nomFichier: string): T[] {
  const chemin = path.join(CACHE_DIR, nomFichier)
  if (!fs.existsSync(chemin)) {
    console.log(`[Tourinsoft] Cache absent : ${nomFichier} — lancer sync-tourinsoft.ts`)
    return []
  }
  try {
    const contenu = fs.readFileSync(chemin, 'utf-8')
    const items = JSON.parse(contenu) as T[]
    console.log(`[Tourinsoft] ${nomFichier} chargé — ${items.length} items`)
    return items
  } catch (err) {
    console.error(`[Tourinsoft] Erreur lecture ${nomFichier} :`, err)
    return []
  }
}

function indexerParCp<T extends { code_postal: string }>(
  items: T[],
  index: Map<string, T[]>
): void {
  for (const item of items) {
    const cp = item.code_postal
    if (!cp) continue
    if (!index.has(cp)) index.set(cp, [])
    index.get(cp)!.push(item)
  }
}

/**
 * Charge tous les fichiers cache Tourinsoft en mémoire au démarrage du microservice.
 * Si les caches sont absents, les maps restent vides (fallback silencieux).
 */
export function chargerTourinsoft(): void {
  const debut = Date.now()

  // Stations : index par id ET par cp_ot
  const stationsRaw = chargerFichier<StationTourinsoft>('stations.json')
  for (const s of stationsRaw) {
    stationsParId.set(s.id, s)
    const cp = s.cp_ot
    if (cp) {
      if (!stationsParCp.has(cp)) stationsParCp.set(cp, [])
      stationsParCp.get(cp)!.push(s)
    }
  }

  // Grands feeds : index par code postal
  const heb = chargerFichier<HebergementTourinsoft>('hebergements.json')
  indexerParCp(heb, hebergementsParCp)

  const act = chargerFichier<ActiviteTourinsoft>('activites.json')
  indexerParCp(act, activitesParCp)

  const com = chargerFichier<CommerceTourinsoft>('commerces.json')
  indexerParCp(com, commercesParCp)

  // Séjours : liste globale
  sejours = chargerFichier<SejourTourinsoft>('sejours.json')

  indexPret = true
  const ms = Date.now() - debut
  console.log(
    `[Tourinsoft] Index prêt en ${ms}ms — ` +
    `${stationsRaw.length} stations, ${heb.length} héb, ${act.length} act, ${com.length} com`
  )
}

// ─── API publique du service ──────────────────────────────────────────────────

export function isTourinsofrPret(): boolean {
  return indexPret
}

/**
 * Retourne la ou les stations correspondant à un code postal.
 * Les stations ANMSM ont un cp_ot = code postal de leur OT.
 */
export function getStationsParCp(code_postal: string): StationTourinsoft[] {
  return stationsParCp.get(code_postal) ?? []
}

/**
 * Retourne une station par son identifiant (ex: STATANMSM01010012).
 */
export function getStationParId(id: string): StationTourinsoft | null {
  return stationsParId.get(id) ?? null
}

/**
 * Retourne les hébergements Tourinsoft pour un code postal donné.
 */
export function getHebergementsParCp(code_postal: string): HebergementTourinsoft[] {
  return hebergementsParCp.get(code_postal) ?? []
}

/**
 * Retourne les activités Tourinsoft pour un code postal donné.
 */
export function getActivitesParCp(code_postal: string): ActiviteTourinsoft[] {
  return activitesParCp.get(code_postal) ?? []
}

/**
 * Retourne les commerces Tourinsoft pour un code postal donné.
 */
export function getCommercesParCp(code_postal: string): CommerceTourinsoft[] {
  return commercesParCp.get(code_postal) ?? []
}

/**
 * Retourne tous les séjours (43 items — pas d'index par CP car très peu nombreux).
 * Filtre optionnel par station_id.
 */
export function getSejours(station_id?: string): SejourTourinsoft[] {
  if (station_id) return sejours.filter(s => s.station_id === station_id)
  return sejours
}

/**
 * Retourne un résumé consolidé pour un code postal :
 * station (si station de montagne), + compteurs héb/act/com.
 */
export function getResumeParCp(code_postal: string) {
  const stations  = getStationsParCp(code_postal)
  const heb       = getHebergementsParCp(code_postal)
  const act       = getActivitesParCp(code_postal)
  const com       = getCommercesParCp(code_postal)

  const total_lits = heb.reduce((s, h) => s + (h.lits || 0), 0)

  return {
    station: stations[0] ?? null,          // station principale (ou null si pas une station ANMSM)
    nb_hebergements: heb.length,
    nb_activites:    act.length,
    nb_commerces:    com.length,
    total_lits,
  }
}
