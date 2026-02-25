// Scraper — Site OT
// Analyse le site de l'office de tourisme pour détecter :
// - Les sections hébergements et activités
// - Le type de commercialisation (réservable direct / lien OTA / listing seul / absent)
// - Les moteurs de réservation connus (Bokun, Regiondo, FareHarbor, Rezdy, Checkfront)

import type { Browser, Page } from 'playwright'
import type { ResultatSiteOT, AnalyseSectionOT, TypeSection } from '@/types/stock-en-ligne'

// Patterns d'URL à tester pour trouver les sections hébergements et activités
const PATTERNS_HEBERGEMENTS = [
  '/hebergements',
  '/hebergement',
  '/ou-dormir',
  '/logements',
  '/hotels',
  '/locations',
  '/search',
  '/reservation',
  '/ou-sejourner',
  '/sejour',
]

const PATTERNS_ACTIVITES = [
  '/activites',
  '/activite',
  '/que-faire',
  '/loisirs',
  '/experiences',
  '/visites',
  '/agenda',
  '/sortir',
]

// Sélecteurs indiquant un moteur de réservation en direct
const SIGNAUX_RESERVABLE_DIRECT = [
  'input[type="date"]',
  '[class*="booking"]',
  '[class*="reservation"]',
  '[class*="calendar"]',
  '[id*="booking"]',
  '[class*="bokun"]',
  '[class*="regiondo"]',
  '[class*="checkfront"]',
  '[class*="fareharbor"]',
  '[class*="rezdy"]',
  'iframe[src*="bokun"]',
  'iframe[src*="regiondo"]',
  'iframe[src*="fareharbor"]',
  'iframe[src*="checkfront"]',
  'iframe[src*="rezdy"]',
  'iframe[src*="reserver"]',
  '[data-widget*="booking"]',
  'form[action*="reserver"]',
  'form[action*="booking"]',
]

// Sélecteurs indiquant un lien vers une OTA
const SIGNAUX_OTA = [
  { selecteur: 'a[href*="booking.com"]',    nom: 'booking'       },
  { selecteur: 'a[href*="airbnb"]',          nom: 'airbnb'        },
  { selecteur: 'a[href*="viator.com"]',      nom: 'viator'        },
  { selecteur: 'a[href*="getyourguide"]',    nom: 'getyourguide'  },
  { selecteur: 'a[href*="tripadvisor"]',     nom: 'tripadvisor'   },
  { selecteur: 'a[href*="abritel"]',         nom: 'abritel'       },
  { selecteur: 'a[href*="gites-de-france"]', nom: 'gites-france'  },
  { selecteur: 'a[href*="clevacances"]',     nom: 'clevacances'   },
  { selecteur: 'a[href*="expedia"]',         nom: 'expedia'       },
  { selecteur: 'a[href*="hotels.com"]',      nom: 'hotels.com'    },
]

// Noms des moteurs de réservation connus (pour identifier lequel est utilisé)
const MOTEURS_RESA = [
  { pattern: 'bokun',      nom: 'bokun'      },
  { pattern: 'regiondo',   nom: 'regiondo'   },
  { pattern: 'fareharbor', nom: 'fareharbor' },
  { pattern: 'checkfront', nom: 'checkfront' },
  { pattern: 'rezdy',      nom: 'rezdy'      },
]

// Sélecteurs de fiches (heuristique pour compter les résultats)
const SELECTEURS_FICHES = [
  '[class*="result"]',
  '[class*="listing"]',
  '[class*="card"]',
  '[class*="item-"]',
  '[class*="product"]',
  'article',
]

/**
 * Crée un contexte Playwright avec les paramètres anti-détection
 */
async function creerContexte(browser: Browser) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  })
  // Bloquer ressources inutiles pour accélérer le chargement
  await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2}', r => r.abort())
  await context.route('**/analytics**', r => r.abort())
  await context.route('**/tracking**', r => r.abort())
  await context.route('**/gtm**', r => r.abort())
  return context
}

/**
 * Tente chaque pattern d'URL — retourne la première URL qui répond 200
 */
async function trouverUrlSection(page: Page, domaine: string, patterns: string[]): Promise<string | null> {
  for (const p of patterns) {
    const url = `https://${domaine}${p}`
    try {
      const reponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 })
      if (reponse?.ok()) return url
    } catch {
      // Continuer au prochain pattern
    }
  }
  return null
}

/**
 * Analyse une page de section (hébergements ou activités)
 * Retourne le type de commercialisation + détails
 */
async function analyserPageSection(page: Page): Promise<{
  est_reservable_direct: boolean
  liens_ota: string[]
  nb_fiches: number
  moteur: string | null
}> {
  await page.waitForTimeout(2000)

  // Détecter moteur de réservation en direct
  let est_reservable_direct = false
  let moteur: string | null = null

  for (const signal of SIGNAUX_RESERVABLE_DIRECT) {
    try {
      const el = await page.$(signal)
      if (el) {
        est_reservable_direct = true
        // Identifier le moteur si possible
        for (const m of MOTEURS_RESA) {
          if (signal.includes(m.pattern)) {
            moteur = m.nom
            break
          }
        }
        break
      }
    } catch {
      // Sélecteur invalide — ignorer
    }
  }

  // Si pas encore trouvé via sélecteur, chercher dans le HTML (iframes avec src)
  if (!est_reservable_direct) {
    try {
      const html = await page.content()
      for (const m of MOTEURS_RESA) {
        if (html.includes(m.pattern)) {
          est_reservable_direct = true
          moteur = m.nom
          break
        }
      }
    } catch {
      // Ignorer
    }
  }

  // Détecter liens OTA
  const liens_ota: string[] = []
  for (const { selecteur, nom } of SIGNAUX_OTA) {
    try {
      const els = await page.$$(selecteur)
      if (els.length > 0 && !liens_ota.includes(nom)) {
        liens_ota.push(nom)
      }
    } catch {
      // Sélecteur invalide — ignorer
    }
  }

  // Compter les fiches (prendre le maximum parmi les sélecteurs)
  let nb_fiches = 0
  for (const sel of SELECTEURS_FICHES) {
    try {
      const els = await page.$$(sel)
      if (els.length > nb_fiches) nb_fiches = els.length
    } catch {
      // Ignorer
    }
  }

  return { est_reservable_direct, liens_ota, nb_fiches, moteur }
}

/**
 * Détermine le type de section selon les données collectées
 */
function classifierSection(
  url: string | null,
  analyse: { est_reservable_direct: boolean; liens_ota: string[]; nb_fiches: number } | null
): TypeSection {
  if (!url || !analyse) return 'absent'
  if (analyse.nb_fiches === 0) return 'absent'
  if (analyse.est_reservable_direct) return 'reservable_direct'
  if (analyse.liens_ota.length > 0) return 'lien_ota'
  return 'listing_seul'
}

/**
 * Scrape le site OT pour analyser la commercialisation hébergements et activités
 */
export async function scraperSiteOT(browser: Browser, domaine_ot: string): Promise<ResultatSiteOT> {
  const debut = Date.now()
  const context = await creerContexte(browser)
  const page = await context.newPage()

  let url_hebergements: string | null = null
  let url_activites: string | null = null
  let analyse_hebergements: Awaited<ReturnType<typeof analyserPageSection>> | null = null
  let analyse_activites: Awaited<ReturnType<typeof analyserPageSection>> | null = null
  let moteur_global: string | null = null

  try {
    // Chercher la section hébergements
    url_hebergements = await trouverUrlSection(page, domaine_ot, PATTERNS_HEBERGEMENTS)
    if (url_hebergements) {
      analyse_hebergements = await analyserPageSection(page)
      if (analyse_hebergements.moteur) moteur_global = analyse_hebergements.moteur
    }

    // Chercher la section activités
    url_activites = await trouverUrlSection(page, domaine_ot, PATTERNS_ACTIVITES)
    if (url_activites) {
      analyse_activites = await analyserPageSection(page)
      if (!moteur_global && analyse_activites.moteur) moteur_global = analyse_activites.moteur
    }
  } finally {
    await context.close()
  }

  const buildSection = (
    url: string | null,
    analyse: typeof analyse_hebergements
  ): AnalyseSectionOT => ({
    nb_fiches: analyse?.nb_fiches ?? 0,
    est_reservable_direct: analyse?.est_reservable_direct ?? false,
    liens_ota: analyse?.liens_ota ?? [],
    type: classifierSection(url, analyse),
  })

  return {
    domaine: domaine_ot,
    url_hebergements,
    url_activites,
    hebergements: buildSection(url_hebergements, analyse_hebergements),
    activites: buildSection(url_activites, analyse_activites),
    moteur_resa_detecte: moteur_global,
    duree_ms: Date.now() - debut,
  }
}
