// Logique métier — stocks-physiques/datatourisme
// Proxy vers le microservice local GET /stocks?code_insee=XXX
// Retourne le stock physique DATA Tourisme classé par catégorie + établissements bruts

import axios from 'axios'
import type { RetourStocksDATATourisme } from '@/types/stocks-physiques'

const MICROSERVICE_URL = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'

/**
 * Récupère le stock physique DATA Tourisme depuis le microservice local.
 * @param code_insee - Code INSEE de la commune cible
 */
export async function executerDataTourisme({
  code_insee,
}: {
  code_insee: string
}): Promise<RetourStocksDATATourisme> {
  if (!code_insee) {
    throw new Error('code_insee requis')
  }

  const reponse = await axios.get<RetourStocksDATATourisme>(
    `${MICROSERVICE_URL}/stocks`,
    {
      params: { code_insee },
      timeout: 60000, // scan de tous les fichiers — peut prendre du temps sur les grandes communes
    }
  )

  return reponse.data
}
