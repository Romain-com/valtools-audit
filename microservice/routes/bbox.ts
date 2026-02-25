// Route GET /bbox — bounding box géographique d'une commune
// Source : geo.api.gouv.fr (contour GeoJSON de la commune)
// Utilisé par le scraper Airbnb pour délimiter la zone de recherche

import { Router, Request, Response } from 'express'

const router = Router()

interface BoundingBox {
  ne_lat: number
  ne_lng: number
  sw_lat: number
  sw_lng: number
}

/**
 * Calcule la bounding box depuis un tableau de coordonnées GeoJSON [lng, lat][]
 */
function calculerBbox(coords: number[][]): BoundingBox {
  const lats = coords.map(c => c[1])
  const lngs = coords.map(c => c[0])
  return {
    ne_lat: Math.max(...lats),
    ne_lng: Math.max(...lngs),
    sw_lat: Math.min(...lats),
    sw_lng: Math.min(...lngs),
  }
}

/**
 * GET /bbox?code_insee=74010
 * Retourne la bounding box géographique de la commune
 * Utilise geo.api.gouv.fr pour obtenir le contour GeoJSON
 */
router.get('/', async (req: Request, res: Response) => {
  const code_insee = req.query.code_insee as string

  if (!code_insee) {
    return res.status(400).json({ erreur: 'Paramètre code_insee requis' })
  }

  try {
    // Tentative 1 : contour GeoJSON complet (polygon)
    const url = `https://geo.api.gouv.fr/communes/${code_insee}?fields=contour,centre&format=json`
    const reponse = await fetch(url)

    if (!reponse.ok) {
      throw new Error(`geo.api.gouv.fr retourne HTTP ${reponse.status}`)
    }

    const data = await reponse.json() as {
      contour?: { type: string; coordinates: number[][][] }
      centre?: { type: string; coordinates: number[] }
    }

    // Calcul bbox depuis le contour polygonal
    if ((data.contour?.coordinates?.[0]?.length ?? 0) > 0) {
      const coords = data.contour!.coordinates[0]
      const bbox = calculerBbox(coords)
      return res.json({ code_insee, bbox, source: 'contour' })
    }

    // Fallback : si pas de contour, utiliser le centre avec une marge ~5km
    if (data.centre?.coordinates?.length === 2) {
      const [lng, lat] = data.centre.coordinates
      const marge = 0.05  // ~5.5km en latitude
      const bbox: BoundingBox = {
        ne_lat: lat + marge,
        ne_lng: lng + marge,
        sw_lat: lat - marge,
        sw_lng: lng - marge,
      }
      return res.json({ code_insee, bbox, source: 'centre_avec_marge' })
    }

    return res.status(404).json({ erreur: `Contour introuvable pour le code INSEE ${code_insee}` })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error(`[BBOX] Erreur pour ${code_insee} :`, message)
    return res.status(500).json({ erreur: message })
  }
})

export default router
