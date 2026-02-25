// Scraper — Airbnb
// Compte les annonces hébergement actives sur Airbnb pour une commune
// Stratégie : découpage récursif en quadrants géographiques si le compteur dépasse SEUIL_MAX
// Source bbox : GET /bbox du microservice local

import type { Browser, Page } from 'playwright'
import type { ResultatAirbnb, BoundingBox } from '@/types/stock-en-ligne'

const SEUIL_MAX      = 1000   // Au-dessus : découper en 4 quadrants
const PROFONDEUR_MAX = 6      // Profondeur max de récursion
const DELAI_MS       = 1800   // Délai entre requêtes (anti-détection)

/**
 * Construit l'URL Airbnb avec les paramètres de bounding box
 */
function buildUrlAirbnb(zone: BoundingBox, destination: string): string {
  const params = new URLSearchParams({
    refinement_paths: '/homes',
    query: destination.toLowerCase(),
    search_mode: 'regular_search',
    price_filter_input_type: '2',
    channel: 'EXPLORE',
    ne_lat: zone.ne_lat.toString(),
    ne_lng: zone.ne_lng.toString(),
    sw_lat: zone.sw_lat.toString(),
    sw_lng: zone.sw_lng.toString(),
    zoom: '13',
    search_by_map: 'true',
    search_type: 'user_map_move',
  })
  return `https://www.airbnb.fr/s/${encodeURIComponent(destination)}/homes?${params}`
}

/**
 * Parse un texte et extrait un nombre (ex: "1 234 logements" → 1234)
 * Retourne null si pas de nombre trouvé
 */
function parseNombreAirbnb(texte: string | null): number | null {
  if (!texte) return null
  const match = texte.replace(/[\s,+]/g, '').match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}

/**
 * Extrait le nombre d'annonces depuis une page Airbnb
 * 3 stratégies de fallback : sélecteurs CSS → regex HTML → comptage des cartes
 */
async function extraireNombreAirbnb(page: Page): Promise<number> {
  await page.waitForTimeout(2500)

  // Stratégie 1 — sélecteurs CSS connus
  const selecteurs = [
    '[data-testid="listing-count"]',
    '[data-section-id="EXPLORE_STAYS_SECTION_CARD"] h2',
    'h1[data-testid="stays-page-heading"]',
    '[data-testid="homes-result-count"]',
    'h2[aria-label*="logement"]',
  ]

  for (const sel of selecteurs) {
    try {
      const el = await page.$(sel)
      if (el) {
        const texte = await el.textContent()
        // Si le texte contient "+" (ex: "1 000+") → dépasse SEUIL_MAX → forcer subdivision
        if (texte && texte.includes('+')) {
          console.log(`[Airbnb] CSS (${sel}) → texte avec "+" détecté → forcer découpage`)
          return SEUIL_MAX + 1
        }
        const n = parseNombreAirbnb(texte)
        if (n !== null && n >= 0) {
          console.log(`[Airbnb] Stratégie CSS (${sel}) → ${n}`)
          return n
        }
      }
    } catch {
      // Sélecteur invalide ou absent — continuer
    }
  }

  // Stratégie 2 — regex sur le HTML brut
  try {
    const contenu = await page.content()
    const patterns = [
      /(\d[\d\s]*)\+?\s*logement/i,
      /(\d[\d\s]*)\+?\s*séjour/i,
      /"resultCount"\s*:\s*(\d+)/,
      /Plus de (\d[\d\s]*)\s*logement/i,
      /"total_count"\s*:\s*(\d+)/,
    ]
    for (const pattern of patterns) {
      const match = contenu.match(pattern)
      if (match) {
        const n = parseNombreAirbnb(match[1])
        if (n !== null && n > 0) {
          console.log(`[Airbnb] Stratégie regex (${pattern}) → ${n}`)
          return n
        }
      }
    }
  } catch {
    // Ignorer
  }

  // Stratégie 3 — compter les cartes visibles
  try {
    const cartes = await page.$$('[data-testid="card-container"]')
    if (cartes.length > 0) {
      // Si 18+ cartes → probablement > SEUIL_MAX (Airbnb pagine à 18/20)
      const estimé = cartes.length >= 18 ? 1001 : cartes.length
      console.log(`[Airbnb] Stratégie comptage cartes → ${cartes.length} cartes → estimé ${estimé}`)
      return estimé
    }
  } catch {
    // Ignorer
  }

  console.log('[Airbnb] Aucune stratégie n\'a fonctionné → 0')
  return 0
}

/**
 * Découpe une zone en 4 quadrants géographiques
 */
function decouper(zone: BoundingBox): BoundingBox[] {
  const midLat = (zone.ne_lat + zone.sw_lat) / 2
  const midLng = (zone.ne_lng + zone.sw_lng) / 2
  return [
    { ne_lat: zone.ne_lat, ne_lng: midLng,      sw_lat: midLat,      sw_lng: zone.sw_lng  },
    { ne_lat: zone.ne_lat, ne_lng: zone.ne_lng,  sw_lat: midLat,      sw_lng: midLng       },
    { ne_lat: midLat,      ne_lng: midLng,       sw_lat: zone.sw_lat, sw_lng: zone.sw_lng  },
    { ne_lat: midLat,      ne_lng: zone.ne_lng,  sw_lat: zone.sw_lat, sw_lng: midLng       },
  ]
}

let compteurRequetes = 0
let compteurZones = 0

/**
 * Compte récursivement les annonces Airbnb dans une zone géographique
 * Si le nombre dépasse SEUIL_MAX → découpe en 4 quadrants et additionne
 */
async function compterZoneAirbnb(
  page: Page,
  zone: BoundingBox,
  destination: string,
  profondeur = 0
): Promise<number> {
  if (profondeur >= PROFONDEUR_MAX) {
    console.log(`[Airbnb] Profondeur max atteinte (${PROFONDEUR_MAX}) → on renvoie 0`)
    return 0
  }

  try {
    await page.goto(buildUrlAirbnb(zone, destination), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    compteurRequetes++
    compteurZones++
    await page.waitForTimeout(DELAI_MS)

    const nombre = await extraireNombreAirbnb(page)
    console.log(`[Airbnb] Zone profondeur=${profondeur} → ${nombre} annonces`)

    if (nombre >= SEUIL_MAX) {
      console.log(`[Airbnb] > ${SEUIL_MAX} → découpage en 4 quadrants`)
      const quadrants = decouper(zone)
      let total = 0
      for (const q of quadrants) {
        total += await compterZoneAirbnb(page, q, destination, profondeur + 1)
        await page.waitForTimeout(500)
      }
      return total
    }

    return nombre
  } catch (err: unknown) {
    console.error(`[Airbnb] Erreur zone profondeur=${profondeur} :`, err instanceof Error ? err.message : err)
    return 0
  }
}

/**
 * Scrape Airbnb pour compter les annonces hébergement sur la commune
 */
export async function scraperAirbnb(
  browser: Browser,
  bbox: BoundingBox,
  destination: string
): Promise<ResultatAirbnb> {
  const debut = Date.now()
  compteurRequetes = 0
  compteurZones = 0

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  })

  // Bloquer ressources inutiles
  await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2}', r => r.abort())
  await context.route('**/analytics**', r => r.abort())
  await context.route('**/tracking**', r => r.abort())
  await context.route('**/sentry**', r => r.abort())

  const page = await context.newPage()

  try {
    const total_annonces = await compterZoneAirbnb(page, bbox, destination)

    return {
      total_annonces,
      nb_requetes: compteurRequetes,
      nb_zones: compteurZones,
      bbox_utilisee: bbox,
      duree_ms: Date.now() - debut,
    }
  } finally {
    await context.close()
  }
}
