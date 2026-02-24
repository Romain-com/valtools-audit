import { Router, Request, Response } from 'express'
import { getPOIParCommune, isIndexPret } from '../services/datatourisme'

const router = Router()

// Types non touristiques à exclure de la sélection POI
const TYPES_EXCLUS = [
  'Accommodation',
  'schema:Accommodation',
  'schema:LodgingBusiness',
  'RentalAccommodation',
  'SelfCateringAccommodation',
  'Guesthouse',
  'Hotel',
  'FoodEstablishment',
  'schema:FoodEstablishment',
  'Restaurant',
  'CafeteriaOrCafeterias',
  'BrasserieOrTavern',
  'CraftsmanShop',
  'Store',
  'schema:Store',
]

// Limite maximale autorisée par requête
const LIMIT_MAX = 50

/**
 * GET /poi?code_insee=XXX&limit=10
 *
 * Retourne les points d'intérêt touristiques d'une commune depuis l'index DATA Tourisme.
 * Logique d'exclusion : tous les types sont acceptés sauf ceux de TYPES_EXCLUS.
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

  // Parsing de la limite avec plafond à LIMIT_MAX
  const limitQuery = parseInt((req.query.limit as string) || '10', 10)
  const limit = isNaN(limitQuery) || limitQuery <= 0
    ? 10
    : Math.min(limitQuery, LIMIT_MAX)

  // Récupération de tous les POI sans filtre de type (types=[] = pas de restriction)
  // On demande un large échantillon pour compenser ceux qui seront exclus
  const tousLesPOI = getPOIParCommune(code_insee, [], LIMIT_MAX)

  // Filtrage par exclusion : on garde un POI si aucun de ses types n'est dans TYPES_EXCLUS
  const poiTouristiques = tousLesPOI
    .filter((poi) => !TYPES_EXCLUS.includes(poi.type_principal))
    .slice(0, limit)

  return res.json({
    code_insee,
    total: poiTouristiques.length,
    poi: poiTouristiques,
  })
})

export default router
