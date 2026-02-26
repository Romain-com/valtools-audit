// Logique métier — résolution EPCI d'une commune
// Proxy vers le microservice local pour récupérer le SIREN de l'EPCI auquel appartient la commune
// Extrait de route.ts pour permettre l'import direct depuis l'orchestrateur (évite les appels auto-référentiels)

import axios from 'axios'

const MICROSERVICE_URL = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'

/**
 * Résout l'EPCI d'une commune à partir de son code INSEE.
 * Retourne { siren_epci: null } si la commune n'appartient à aucun EPCI (cas normal).
 * Ne throw jamais pour le cas 404 — ce n'est pas une erreur.
 */
export async function executerEPCI({ code_insee }: { code_insee: string }): Promise<{
  siren_epci: string | null
  nom_epci?: string
  type_epci?: string
  population_epci?: number
}> {
  if (!code_insee) {
    throw new Error('code_insee requis')
  }

  try {
    const reponse = await axios.get(`${MICROSERVICE_URL}/epci`, {
      params: { code_insee },
      timeout: 5000,
    })

    return reponse.data
  } catch (err: unknown) {
    // 404 du microservice = commune sans EPCI — cas normal, pas une erreur
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return { siren_epci: null }
    }

    throw err
  }
}
