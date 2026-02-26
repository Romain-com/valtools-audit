// Logique métier — DATA Tourisme POI
// Responsabilité : récupérer les POI bruts d'une destination via le microservice DATA Tourisme
// Importé directement par l'orchestrateur pour éviter les appels HTTP auto-référentiels

import axios from 'axios'
import type { POIBrut } from '@/types/positionnement'

// Timeout court — le microservice DATA Tourisme est local/rapide
const TIMEOUT_MS = 10_000

interface ReponsePOI {
  poi: POIBrut[]
  erreur?: boolean
}

/**
 * Récupère les POI bruts pour un code INSEE donné via le microservice DATA Tourisme.
 * En cas d'erreur, retourne un tableau vide avec le flag erreur (ne bloque pas le flux).
 */
export async function executerPOI({ code_insee }: { code_insee: string }): Promise<ReponsePOI> {
  if (!code_insee) {
    throw new Error('Paramètre code_insee manquant')
  }

  const apiUrl = process.env.DATA_TOURISME_API_URL

  if (!apiUrl) {
    throw new Error('Variable DATA_TOURISME_API_URL manquante')
  }

  // ─── Appel au microservice DATA Tourisme ─────────────────────────────────
  try {
    const response = await axios.get<POIBrut[]>(
      `${apiUrl}/poi`,
      {
        params: {
          code_insee,
          limit: 10,
        },
        timeout: TIMEOUT_MS,
      }
    )

    const poi = Array.isArray(response.data) ? response.data : []

    return { poi }
  } catch (err) {
    // Fallback : tableau vide — la suite du flux doit gérer ce cas (poi-selection le détecte)
    console.error('[POI] Erreur appel DATA Tourisme :', err)
    return { poi: [], erreur: true }
  }
}
