import fs from 'fs'
import path from 'path'
import { Router, Request, Response } from 'express'
import { getFilepathsParCommune, isIndexPret } from '../services/datatourisme'

const router = Router()

// ─── Tables de classification des types @type ──────────────────────────────────

// Priorité décroissante — la première règle qui match gagne

const TYPES_HEBERGEMENT = new Set([
  'Hotel', 'schema:Hotel', 'HotelTrade',
  'CollectiveAccommodation', 'HolidayResort',
  'RentalAccommodation', 'SelfCateringAccommodation',
  'Accommodation', 'schema:Accommodation', 'schema:LodgingBusiness',
])

const TYPES_RESTAURATION = new Set([
  'FoodEstablishment', 'schema:FoodEstablishment',
  'Restaurant', 'schema:Restaurant', 'HotelRestaurant',
  'BistroOrWineBar', 'BarOrPub',
])

const TYPES_ACTIVITES = new Set([
  'SportsAndLeisurePlace', 'ActivityProvider',
  'FitnessCenter', 'TennisComplex', 'ClimbingWall',
  'SwimmingPool', 'EquestrianCenter', 'BoulesPitch',
  'LeisureComplex', 'ZooAnimalPark', 'NauticalCentre',
  'Tour', 'WalkingTour', 'EducationalTrail',
  'CyclingTour', 'SightseeingBoat',
  'TastingProvider',
  'EntertainmentAndEvent', 'schema:Event',
])

const TYPES_CULTURE = new Set([
  'CulturalSite', 'Church', 'ReligiousSite', 'Cathedral',
  'Convent', 'Monastery', 'CityHeritage', 'Museum', 'schema:Museum',
  'Castle', 'RemarkableBuilding', 'TechnicalHeritage',
  'NaturalHeritage', 'ArtGalleryOrExhibitionGallery',
  'Theater', 'Cinema', 'schema:MovieTheater',
  'Library', 'schema:Library', 'InterpretationCentre',
  'Palace', 'Bridge', 'ParkAndGarden', 'schema:Park',
  'Beach', 'Marina', 'RiverPort', 'Canal',
])

// Sous-ensembles pour classification fine de la culture
const TYPES_CULTURE_RELIGIEUX = new Set([
  'Church', 'ReligiousSite', 'Cathedral', 'Convent', 'Monastery',
])
const TYPES_CULTURE_MUSEES = new Set([
  'Museum', 'schema:Museum', 'ArtGalleryOrExhibitionGallery',
  'Library', 'schema:Library',
])
const TYPES_CULTURE_SPECTACLE = new Set([
  'Theater', 'Cinema', 'schema:MovieTheater',
])
const TYPES_CULTURE_NATURE = new Set([
  'NaturalHeritage', 'ParkAndGarden', 'schema:Park',
  'Beach', 'Marina', 'RiverPort', 'Canal',
])
// patrimoine = tout le reste (Castle, RemarkableBuilding, CulturalSite, TechnicalHeritage,
//   InterpretationCentre, CityHeritage, Palace, Bridge...)

const TYPES_SERVICES = new Set([
  'TouristInformationCenter', 'schema:TouristInformationCenter',
  'LocalTouristOffice', 'IncomingTravelAgency',
  'TourOperatorOrTravelAgency', 'Transport',
  'EquipmentRental', 'EquipmentRentalShop', 'Rental',
  'ServiceProvider', 'ConvenientService',
])

// ─── Détection de sous-catégories ─────────────────────────────────────────────

function detecterSousCategHebergement(types: string[]): string {
  if (types.some(t => ['Hotel', 'schema:Hotel', 'HotelTrade'].includes(t))) return 'hotels'
  if (types.some(t => ['CollectiveAccommodation', 'HolidayResort'].includes(t))) return 'collectifs'
  if (types.some(t => ['RentalAccommodation', 'SelfCateringAccommodation'].includes(t))) return 'locations'
  return 'autres'
}

function detecterSousCategCulture(types: string[]): string {
  if (types.some(t => TYPES_CULTURE_RELIGIEUX.has(t))) return 'religieux'
  if (types.some(t => TYPES_CULTURE_MUSEES.has(t))) return 'musees_galeries'
  if (types.some(t => TYPES_CULTURE_SPECTACLE.has(t))) return 'spectacle_vivant'
  if (types.some(t => TYPES_CULTURE_NATURE.has(t))) return 'nature'
  return 'patrimoine'
}

function detecterSousCategActivite(types: string[]): string {
  if (types.some(t => ['Tour', 'WalkingTour', 'EducationalTrail', 'CyclingTour', 'SightseeingBoat'].includes(t))) {
    return 'visites_tours'
  }
  if (types.some(t => ['TastingProvider', 'EntertainmentAndEvent', 'schema:Event'].includes(t))) {
    return 'experiences'
  }
  return 'sports_loisirs'
}

function detecterSousCategService(types: string[]): string {
  if (types.some(t => ['TouristInformationCenter', 'schema:TouristInformationCenter', 'LocalTouristOffice'].includes(t))) {
    return 'offices_tourisme'
  }
  if (types.some(t => ['IncomingTravelAgency', 'TourOperatorOrTravelAgency'].includes(t))) return 'agences'
  if (types.some(t => ['EquipmentRental', 'EquipmentRentalShop', 'Rental'].includes(t))) return 'location_materiel'
  if (types.includes('Transport')) return 'transport'
  return 'offices_tourisme' // fallback
}

// ─── Classification principale (1 fichier = 1 catégorie) ──────────────────────

interface ClassificationResult {
  categorie: string
  sous_categorie: string | null
}

function classerEtablissement(types: string[]): ClassificationResult | null {
  // 1. Hébergement ?
  if (types.some(t => TYPES_HEBERGEMENT.has(t))) {
    return { categorie: 'hebergements', sous_categorie: detecterSousCategHebergement(types) }
  }
  // 2. Restauration → ignorer
  if (types.some(t => TYPES_RESTAURATION.has(t))) return null
  // 3. Activité ?
  if (types.some(t => TYPES_ACTIVITES.has(t))) {
    return { categorie: 'activites', sous_categorie: detecterSousCategActivite(types) }
  }
  // 4. Culture ?
  if (types.some(t => TYPES_CULTURE.has(t))) {
    return { categorie: 'culture', sous_categorie: detecterSousCategCulture(types) }
  }
  // 5. Service touristique ?
  if (types.some(t => TYPES_SERVICES.has(t))) {
    return { categorie: 'services', sous_categorie: detecterSousCategService(types) }
  }
  // 6. Sinon → ignorer
  return null
}

// ─── Extraction téléphone ──────────────────────────────────────────────────────

function extraireTelephone(data: Record<string, unknown>): string | null {
  try {
    const contacts = data['hasContact'] as Record<string, unknown>[] | undefined
    const tel = contacts?.[0]?.['schema:telephone']
    if (Array.isArray(tel)) return String(tel[0])
    if (typeof tel === 'string') return tel
    return null
  } catch {
    return null
  }
}

// ─── Extraction adresse et code postal ────────────────────────────────────────

function extraireAdresse(data: Record<string, unknown>): { adresse: string | null; code_postal: string | null } {
  try {
    const isLocatedAt = data['isLocatedAt'] as Record<string, unknown>[] | undefined
    const adresseObj = (isLocatedAt?.[0]?.['schema:address'] as Record<string, unknown>[] | undefined)?.[0]
    if (!adresseObj) return { adresse: null, code_postal: null }

    const rue = [
      adresseObj['schema:streetAddress'],
      adresseObj['schema:postalCode'],
    ]
      .filter(Boolean)
      .join(' ')
      .trim()

    const cp = adresseObj['schema:postalCode'] as string | undefined

    return {
      adresse: rue || null,
      code_postal: cp ?? null,
    }
  } catch {
    return { adresse: null, code_postal: null }
  }
}

// ─── Extraction GPS ────────────────────────────────────────────────────────────

function extraireGPS(data: Record<string, unknown>): { lat: number | null; lng: number | null } {
  try {
    const isLocatedAt = data['isLocatedAt'] as Record<string, unknown>[] | undefined
    const geo = isLocatedAt?.[0]?.['schema:geo'] as Record<string, string> | undefined
    if (!geo) return { lat: null, lng: null }
    const lat = parseFloat(geo['schema:latitude'])
    const lng = parseFloat(geo['schema:longitude'])
    return {
      lat: isNaN(lat) ? null : lat,
      lng: isNaN(lng) ? null : lng,
    }
  } catch {
    return { lat: null, lng: null }
  }
}

// ─── Endpoint /stocks ──────────────────────────────────────────────────────────

/**
 * GET /stocks?code_insee=74010
 *
 * Retourne le stock physique complet d'une commune depuis l'index DATA Tourisme.
 * Classe chaque établissement dans UNE seule catégorie (priorité décroissante).
 * Aucun filtre d'exclusion préalable — la classification gère elle-même les exclusions.
 */
router.get('/', async (req: Request, res: Response) => {
  // Vérification : l'index est-il prêt ?
  if (!isIndexPret()) {
    return res.status(503).json({
      erreur: 'Index en cours de construction, réessayer dans quelques instants',
    })
  }

  const code_insee = (req.query.code_insee as string)?.trim()
  if (!code_insee) {
    return res.status(400).json({ erreur: 'Le paramètre "code_insee" est requis' })
  }

  const filepaths = getFilepathsParCommune(code_insee)
  if (filepaths.length === 0) {
    return res.status(404).json({
      erreur: `Aucun fichier trouvé pour la commune INSEE ${code_insee}`,
    })
  }

  // Compteurs par catégorie et sous-catégorie
  const compteurs = {
    hebergements: { total: 0, hotels: 0, collectifs: 0, locations: 0, autres: 0 },
    activites: { total: 0, sports_loisirs: 0, visites_tours: 0, experiences: 0 },
    culture: { total: 0, patrimoine: 0, religieux: 0, musees_galeries: 0, spectacle_vivant: 0, nature: 0 },
    services: { total: 0, offices_tourisme: 0, agences: 0, location_materiel: 0, transport: 0 },
  }

  const etablissements_bruts: object[] = []

  for (const filepath of filepaths) {
    try {
      const contenu = fs.readFileSync(filepath, 'utf-8')
      const data = JSON.parse(contenu) as Record<string, unknown>

      // Nom
      const labelFr = (data['rdfs:label'] as Record<string, string[]> | undefined)?.['fr']
      const nom = labelFr?.[0]
      if (!nom) continue

      // Types bruts (tous, sans filtre préalable)
      const typesRaw = data['@type'] as string[] | undefined
      if (!typesRaw || typesRaw.length === 0) continue

      // Classification
      const classif = classerEtablissement(typesRaw)
      if (!classif) continue // restauration ou type ignoré

      const { categorie, sous_categorie } = classif
      const cat = compteurs[categorie as keyof typeof compteurs]
      cat.total++
      if (sous_categorie && sous_categorie in cat) {
        ;(cat as Record<string, number>)[sous_categorie]++
      }

      // Infos complémentaires pour la déduplication
      const uuid = path.basename(filepath, '.json')
      const telephone = extraireTelephone(data)
      const { adresse, code_postal } = extraireAdresse(data)
      const { lat, lng } = extraireGPS(data)

      etablissements_bruts.push({
        uuid,
        nom,
        categorie,
        sous_categorie,
        telephone,
        adresse,
        code_postal,
        lat,
        lng,
      })
    } catch {
      // Fichier corrompu ou structure inattendue — on ignore
    }
  }

  const total_etablissements = (
    compteurs.hebergements.total +
    compteurs.activites.total +
    compteurs.culture.total +
    compteurs.services.total
  )

  return res.json({
    code_insee,
    total_etablissements,
    hebergements: compteurs.hebergements,
    activites: compteurs.activites,
    culture: compteurs.culture,
    services: compteurs.services,
    etablissements_bruts,
  })
})

export default router
