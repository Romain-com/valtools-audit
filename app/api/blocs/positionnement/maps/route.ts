// Route Handler — DataForSEO Maps
// Responsabilité : récupérer les fiches Google Maps de la destination et de son OT
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { ResultatMaps, FicheGoogle, FicheGoogleAbsente } from '@/types/positionnement'

// URL de l'API DataForSEO Maps
const DATAFORSEO_URL = 'https://api.dataforseo.com/v3/serp/google/maps/live/advanced'

// Timeout généreux — DataForSEO Maps peut être lent (60s recommandé)
const TIMEOUT_MS = 60_000

// Coût unitaire par appel Maps (en euros)
const COUT_UNITAIRE = 0.006

interface DataForSEOItem {
  type: string
  title?: string
  rating?: {
    value?: number
    votes_count?: number
  }
  address?: string
}

interface DataForSEOResult {
  items?: DataForSEOItem[]
}

interface DataForSEOTask {
  result?: DataForSEOResult[]
  status_code?: number
  status_message?: string
}

interface DataForSEOResponse {
  tasks?: DataForSEOTask[]
}

/**
 * Fait un seul appel DataForSEO Maps pour un keyword donné.
 * ⚠️ Une seule tâche dans l'array — erreur 40000 si plusieurs.
 */
async function appelMaps(keyword: string, auth: string): Promise<DataForSEOTask> {
  const response = await axios.post<DataForSEOResponse>(
    DATAFORSEO_URL,
    // Une seule tâche dans l'array (contrainte DataForSEO)
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
 * Extrait la première fiche Maps pertinente depuis les items DataForSEO.
 * Retourne null si aucune fiche trouvée.
 */
function extrairePremiereFiche(task: DataForSEOTask): FicheGoogle | null {
  const items = task.result?.[0]?.items ?? []

  // On cherche le premier item de type "maps_search" ou "local_pack"
  const fiche = items.find(
    (item) => item.type === 'maps_search' || item.type === 'local_pack' || item.type === 'google_maps'
  ) ?? items[0]

  if (!fiche || !fiche.title) return null

  return {
    nom: fiche.title,
    note: fiche.rating?.value ?? 0,
    avis: fiche.rating?.votes_count ?? 0,
    adresse: fiche.address ?? '',
  }
}

export async function POST(request: NextRequest) {
  // Lecture du body
  const body = await request.json().catch(() => ({}))
  const { destination } = body as { destination?: string; domaine_ot?: string }

  if (!destination) {
    return NextResponse.json({ erreur: 'Paramètre destination manquant' }, { status: 400 })
  }

  // Construction de l'auth Basic DataForSEO
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD

  if (!login || !password) {
    return NextResponse.json({ erreur: 'Variables DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD manquantes' }, { status: 500 })
  }

  const auth = Buffer.from(`${login}:${password}`).toString('base64')

  // ─── Appel 1 : fiche de la destination ───────────────────────────────────
  let ficheDestination: FicheGoogle = {
    nom: destination,
    note: 0,
    avis: 0,
    adresse: '',
  }

  try {
    const taskDestination = await appelMaps(destination, auth)
    const extraite = extrairePremiereFiche(taskDestination)
    if (extraite) ficheDestination = extraite
  } catch (err) {
    // Fallback : on continue avec les valeurs par défaut
    console.error('[Maps] Erreur appel destination :', err)
  }

  // ─── Appel 2 : fiche de l'OT ─────────────────────────────────────────────
  let ficheOT: FicheGoogle | FicheGoogleAbsente = { absent: true }

  try {
    const keywordOT = `Office de tourisme ${destination}`
    const taskOT = await appelMaps(keywordOT, auth)
    const extraite = extrairePremiereFiche(taskOT)
    if (extraite) {
      ficheOT = extraite
    }
    // Si aucune fiche trouvée → on laisse { absent: true }
  } catch (err) {
    // Fallback : OT absent, ne bloque pas le reste
    console.error('[Maps] Erreur appel OT :', err)
  }

  // ─── Calcul du score de synthèse ─────────────────────────────────────────
  // Les villes n'ont pas de note Google Maps — seuls les établissements sont notés.
  // Stratégie : on ne pondère que les notes disponibles (> 0).
  let scoreSynthese: number

  const noteDestination = ficheDestination.note   // 0 si ville sans note
  const noteOT = 'absent' in ficheOT ? 0 : ficheOT.note

  if (noteDestination > 0 && noteOT > 0) {
    // Les deux ont une note → moyenne pondérée destination × 0.7, OT × 0.3
    scoreSynthese = Math.round((noteDestination * 0.7 + noteOT * 0.3) * 10) / 10
  } else if (noteOT > 0) {
    // Seul l'OT a une note → on utilise la note OT
    scoreSynthese = noteOT
  } else {
    // Seule la destination a une note (ou aucune)
    scoreSynthese = noteDestination
  }

  // ─── Construction de la réponse ──────────────────────────────────────────
  const resultat: ResultatMaps = {
    destination: ficheDestination,
    ot: ficheOT,
    score_synthese: scoreSynthese,
    cout: {
      nb_appels: 2,
      cout_unitaire: COUT_UNITAIRE,
      cout_total: COUT_UNITAIRE * 2,
    },
  }

  return NextResponse.json(resultat)
}
