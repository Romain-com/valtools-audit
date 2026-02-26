// Logique métier — récupération des communes d'un EPCI
// Proxy vers le microservice local pour lister toutes les communes membres d'un EPCI
// Extrait de route.ts pour permettre l'import direct depuis l'orchestrateur (évite les appels auto-référentiels)

import axios from 'axios'

const MICROSERVICE_URL = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'

/**
 * Récupère la liste des communes appartenant à un EPCI.
 * Retourne { communes: [] } si l'EPCI n'a pas de communes dans le référentiel (cas rare).
 * Ne throw jamais pour le cas 404 — ce n'est pas une erreur.
 */
export async function executerEPCICommunes({ siren_epci }: { siren_epci: string }): Promise<{
  communes?: { code_insee: string; nom: string }[]
}> {
  if (!siren_epci) {
    throw new Error('siren_epci requis')
  }

  try {
    const reponse = await axios.get(`${MICROSERVICE_URL}/epci/communes`, {
      params: { siren_epci },
      timeout: 5000,
    })

    return reponse.data
  } catch (err: unknown) {
    // 404 = EPCI sans communes dans le référentiel — cas rare mais gérable
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return { communes: [] }
    }

    throw err
  }
}
