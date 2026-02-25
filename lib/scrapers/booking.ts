// Scraper — Booking.com
// Compte les propriétés hébergement sur Booking.com pour une destination
// Stratégie : page de résultats filtrée par ville + 5 appels séquentiels par type d'hébergement

import type { Browser, Page } from 'playwright'
import type { ResultatBooking, DetailBooking } from '@/types/stock-en-ligne'

const DELAI_ENTRE_APPELS = 1500  // Délai anti-détection entre les appels (ms)

// Filtres par type d'hébergement Booking (ht_id)
const FILTRES_BOOKING = {
  hotels:   'ht_id=204',
  apparts:  'ht_id=201',
  campings: 'ht_id=216',
  bb:       'ht_id=208',
  villas:   'ht_id=213',
} as const

type CleFiltre = keyof typeof FILTRES_BOOKING

/**
 * Construit l'URL Booking.com pour une destination avec un type d'hébergement optionnel
 */
function buildUrlBooking(destination: string, filtre?: string): string {
  const base = `https://www.booking.com/searchresults.fr.html?` +
    `ss=${encodeURIComponent(destination)}&` +
    `lang=fr&` +
    `sb=1&` +
    `src=searchresults&` +
    `dest_type=city&` +
    `checkin=2026-07-01&` +
    `checkout=2026-07-02&` +
    `group_adults=2&` +
    `no_rooms=1`

  return filtre ? `${base}&${filtre}` : base
}

/**
 * Extrait le nombre de propriétés depuis une page Booking
 * Plusieurs stratégies de fallback
 */
async function extraireNombreBooking(page: Page, contexte: string): Promise<number> {
  await page.waitForTimeout(3000)

  // Stratégie 1 — sélecteurs CSS connus (h1 en premier — le plus fiable)
  const selecteurs = [
    'h1',
    '[data-testid="property-list-header"]',
    'h1.sr_header',
    '.sorth2',
    'h2.sr_header--title',
    '[data-testid="searchresults_header"]',
    '[class*="results-header"]',
  ]

  for (const sel of selecteurs) {
    try {
      const el = await page.$(sel)
      if (el) {
        const texte = await el.textContent()
        // Patterns : "423 établissements" / "1 234 propriétés" / "1 234 hébergements"
        const match = texte?.match(/(\d[\d\s]*)\s*(établissement|propriété|hébergement|logement|résultat)/i)
        if (match) {
          const n = parseInt(match[1].replace(/\s/g, ''), 10)
          if (!isNaN(n) && n >= 0) {
            console.log(`[Booking/${contexte}] CSS (${sel}) → ${n}`)
            return n
          }
        }
      }
    } catch {
      // Continuer
    }
  }

  // Stratégie 2 — regex sur le HTML brut
  try {
    const contenu = await page.content()
    const patterns = [
      /(\d[\d\s]+)\s*établissement/i,
      /(\d[\d\s]+)\s*propriété/i,
      /(\d[\d\s]+)\s*hébergement/i,
      /"nb_hotels"\s*:\s*(\d+)/,
      /data-count="(\d+)"/,
      /"result_count"\s*:\s*(\d+)/,
    ]
    for (const pattern of patterns) {
      const match = contenu.match(pattern)
      if (match) {
        const n = parseInt(match[1].replace(/\s/g, ''), 10)
        if (!isNaN(n) && n > 0) {
          console.log(`[Booking/${contexte}] Regex (${pattern}) → ${n}`)
          return n
        }
      }
    }
  } catch {
    // Ignorer
  }

  console.log(`[Booking/${contexte}] Aucune stratégie → 0`)
  return 0
}

/**
 * Effectue un appel Booking et retourne le nombre de résultats
 */
async function appelBooking(page: Page, destination: string, filtre: string | undefined, contexte: string): Promise<number> {
  const url = buildUrlBooking(destination, filtre)
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    return await extraireNombreBooking(page, contexte)
  } catch (err: unknown) {
    console.error(`[Booking/${contexte}] Erreur :`, err instanceof Error ? err.message : err)
    return 0
  }
}

/**
 * Scrape Booking.com pour compter les propriétés hébergement sur la destination
 * Effectue 1 appel global + 5 appels par type (séquentiels avec délai)
 */
export async function scraperBooking(browser: Browser, destination: string): Promise<ResultatBooking> {
  const debut = Date.now()

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  })

  await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2}', r => r.abort())
  await context.route('**/analytics**', r => r.abort())
  await context.route('**/tracking**', r => r.abort())

  const page = await context.newPage()

  try {
    // Un seul appel sans filtre — le filtre ht_id ne change pas le compteur h1
    // Les sous-catégories ne sont pas extractibles via cette méthode
    const total_proprietes = await appelBooking(page, destination, undefined, 'total')
    const detail: DetailBooking = { hotels: 0, apparts: 0, campings: 0, bb: 0, villas: 0 }

    return {
      total_proprietes,
      detail,
      duree_ms: Date.now() - debut,
    }
  } finally {
    await context.close()
  }
}
