// Logique métier — DataForSEO Maps
// Responsabilité : récupérer les fiches Google Maps de l'OT + 3 POI sélectionnés
// Importé directement par l'orchestrateur pour éviter les appels HTTP auto-référentiels
// ⚠️  4 appels séquentiels — une seule tâche par requête (contrainte DataForSEO)

import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { FicheGoogle, FicheGoogleAbsente, FicheGooglePOI, POISelectionne } from '@/types/positionnement'

// URL de l'API DataForSEO Maps
const DATAFORSEO_URL = 'https://api.dataforseo.com/v3/serp/google/maps/live/advanced'

// Timeout généreux — DataForSEO Maps peut être lent
const TIMEOUT_MS = 60_000

// Nombre d'appels total pour ce module
const NB_APPELS = 4

// ─── Types internes DataForSEO ───────────────────────────────────────────────

interface DataForSEOItem {
  type: string
  title?: string
  rating?: {
    value?: number
    votes_count?: number
  }
  address?: string
}

interface DataForSEOTask {
  result?: Array<{ items?: DataForSEOItem[] }>
}

interface DataForSEOResponse {
  tasks?: DataForSEOTask[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fait un seul appel DataForSEO Maps pour un keyword donné.
 * ⚠️ Une seule tâche dans l'array — erreur 40000 si plusieurs.
 */
async function appelMaps(keyword: string, auth: string): Promise<DataForSEOTask> {
  const response = await axios.post<DataForSEOResponse>(
    DATAFORSEO_URL,
    [{ keyword, language_name: 'French', location_name: 'France' }],
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      timeout: TIMEOUT_MS,
    }
  )
  return response.data.tasks?.[0] ?? {}
}

/**
 * Extrait la première fiche pertinente depuis les items DataForSEO.
 * Priorité aux items de type "organic" (établissements naturels, pas les annonces).
 * Fallback sur le premier item avec un titre si aucun organic trouvé.
 */
function extrairePremiereFiche(task: DataForSEOTask): FicheGoogle | null {
  const items = task.result?.[0]?.items ?? []

  // Chercher en priorité les résultats organiques (pas les annonces)
  const fiche =
    items.find((item) => item.type === 'organic') ??
    items.find((item) => Boolean(item.title)) ??
    items[0]

  if (!fiche?.title) return null

  return {
    nom: fiche.title,
    note: fiche.rating?.value ?? 0,
    avis: fiche.rating?.votes_count ?? 0,
    adresse: fiche.address ?? '',
  }
}

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Récupère les fiches Google Maps de l'OT et des 3 POI sélectionnés pour une destination.
 * Calcule un score de synthèse pondéré (POI × 0.7 + OT × 0.3).
 */
export async function executerMaps({
  destination,
  poi_selectionnes,
}: {
  destination: string
  poi_selectionnes?: POISelectionne[]
}) {
  if (!destination) {
    throw new Error('Paramètre destination manquant')
  }

  // Construction de l'auth Basic DataForSEO
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD

  if (!login || !password) {
    throw new Error('Variables DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD manquantes')
  }

  const auth = Buffer.from(`${login}:${password}`).toString('base64')

  // ─── Appel 1 : fiche de l'OT ─────────────────────────────────────────────
  let ficheOT: FicheGoogle | FicheGoogleAbsente = { absent: true }

  try {
    const keywordOT = `Office de tourisme ${destination}`
    const task = await appelMaps(keywordOT, auth)
    const extraite = extrairePremiereFiche(task)
    if (extraite) ficheOT = extraite
    // Si aucune fiche trouvée → { absent: true }, ne bloque pas le reste
  } catch (err) {
    console.error('[Maps] Erreur appel OT :', err)
  }

  // ─── Appels 2/3/4 : fiches des 3 POI sélectionnés ────────────────────────
  // Séquentiels — une seule tâche par requête DataForSEO (contrainte stricte)
  const fichesPOI: FicheGooglePOI[] = []
  const pois = poi_selectionnes ?? []

  for (const poi of pois.slice(0, 3)) {
    try {
      const task = await appelMaps(poi.nom, auth)
      const extraite = extrairePremiereFiche(task)
      fichesPOI.push(extraite ?? { absent: true })
    } catch (err) {
      // Fallback : POI absent — ne bloque pas les suivants
      console.error(`[Maps] Erreur appel POI "${poi.nom}" :`, err)
      fichesPOI.push({ absent: true })
    }
  }

  // ─── Calcul du score de synthèse ─────────────────────────────────────────
  // Formule : score = moyenne_poi × 0.7 + note_ot × 0.3
  // On exclut du calcul les fiches absentes ou sans note

  const notesPOI = fichesPOI
    .filter((f): f is FicheGoogle => !('absent' in f) && f.note > 0)
    .map((f) => f.note)

  const moyennePOI =
    notesPOI.length > 0
      ? notesPOI.reduce((acc, n) => acc + n, 0) / notesPOI.length
      : 0

  const noteOT = 'absent' in ficheOT ? 0 : ficheOT.note

  let scoreSynthese: number

  if (moyennePOI > 0 && noteOT > 0) {
    // Cas standard : POI et OT tous les deux présents
    scoreSynthese = Math.round((moyennePOI * 0.7 + noteOT * 0.3) * 10) / 10
  } else if (moyennePOI > 0) {
    // OT absent → score = moyenne des POI uniquement
    scoreSynthese = Math.round(moyennePOI * 10) / 10
  } else {
    // Aucun POI noté → score = note OT (ou 0 si OT absent aussi)
    scoreSynthese = noteOT
  }

  // ─── Construction de la réponse ──────────────────────────────────────────
  return {
    ot: ficheOT,
    poi: fichesPOI,
    score_synthese: scoreSynthese,
    cout: {
      dataforseo: {
        nb_appels: NB_APPELS,
        cout_unitaire: API_COSTS.dataforseo_maps,
        cout_total: NB_APPELS * API_COSTS.dataforseo_maps,
      },
    },
  }
}
