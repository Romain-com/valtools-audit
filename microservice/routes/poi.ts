import { Router, Request, Response } from 'express'
import { getPOIParCommune, isIndexPret } from '../services/datatourisme'

const router = Router()

// Types DATA Tourisme retournés par défaut si le paramètre est absent
const TYPES_PAR_DEFAUT = ['PointOfInterest', 'SportsAndLeisurePlace']

// Limite maximale autorisée par requête
const LIMIT_MAX = 50

/**
 * GET /poi?code_insee=XXX&types=PointOfInterest,SportsAndLeisurePlace&limit=10
 *
 * Retourne les points d'intérêt d'une commune depuis l'index DATA Tourisme.
 * L'index est construit au démarrage — si pas encore prêt, retourne HTTP 503.
 */
router.get('/', (req: Request, res: Response) => {
  // Vérification : l'index est-il prêt ?
  if (!isIndexPret()) {
    return res.status(503).json({
      erreur: 'Index en cours de construction, réessayer dans quelques instants',
    })
  }

  const code_insee = (req.query.code_insee as string)?.trim()
  if (!code_insee) {
    return res.status(400).json({
      erreur: 'Le paramètre "code_insee" est requis',
    })
  }

  // Parsing des types : "PointOfInterest,SportsAndLeisurePlace" → tableau
  const typesQuery = req.query.types as string | undefined
  const types = typesQuery
    ? typesQuery.split(',').map((t) => t.trim()).filter(Boolean)
    : TYPES_PAR_DEFAUT

  // Parsing de la limite avec plafond à LIMIT_MAX
  const limitQuery = parseInt((req.query.limit as string) || '10', 10)
  const limit = isNaN(limitQuery) || limitQuery <= 0
    ? 10
    : Math.min(limitQuery, LIMIT_MAX)

  const poi = getPOIParCommune(code_insee, types, limit)

  return res.json({
    code_insee,
    total: poi.length,
    poi,
  })
})

export default router
