// Scraper — Viator
// Compte les activités/expériences référencées sur Viator pour une destination
// Stratégie : URL avec slug normalisé + fallback URL de recherche

import type { Browser, Page } from 'playwright'
import type { ResultatViator } from '@/types/stock-en-ligne'

/**
 * Normalise un nom de destination en slug Viator
 * ex: "Annecy" → "annecy", "Le Mont-Saint-Michel" → "le-mont-saint-michel"
 */
function normaliserSlug(destination: string): string {
  return destination
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Construit les URLs Viator à tester pour une destination
 * Plusieurs formats possibles selon comment Viator référence la ville
 */
function buildUrlsViator(destination: string): Array<{ url: string; slug: string }> {
  const slug = normaliserSlug(destination)
  return [
    // Format principal : /fr-FR/{slug}/d-ddaa/
    { url: `https://www.viator.com/fr-FR/${slug}/d-ddaa/`, slug },
    // Format alternatif avec majuscule
    { url: `https://www.viator.com/fr-FR/${slug.charAt(0).toUpperCase() + slug.slice(1)}/d-ddaa/`, slug },
    // Format recherche (fallback)
    { url: `https://www.viator.com/fr-FR/search?q=${encodeURIComponent(destination)}`, slug: 'recherche' },
  ]
}

/**
 * Extrait le nombre d'activités depuis une page Viator
 */
async function extraireNombreViator(page: Page): Promise<number> {
  await page.waitForTimeout(3000)

  // Stratégie 1 — sélecteurs CSS connus
  const selecteurs = [
    '[data-test-id="results-count"]',
    '[class*="resultsCount"]',
    '[class*="result-count"]',
    '[class*="product-count"]',
    'h1[class*="heading"]',
    '[data-test-id="search-results-header"]',
  ]

  for (const sel of selecteurs) {
    try {
      const el = await page.$(sel)
      if (el) {
        const texte = await el.textContent()
        // Patterns : "127 activités" / "85 expériences" / "42 visites"
        const match = texte?.match(/(\d[\d\s]*)\s*(activité|expérience|visite|tour|résultat)/i)
        if (match) {
          const n = parseInt(match[1].replace(/\s/g, ''), 10)
          if (!isNaN(n) && n >= 0) {
            console.log(`[Viator] CSS (${sel}) → ${n}`)
            return n
          }
        }
        // Fallback : juste un nombre seul dans l'élément
        const matchSimple = texte?.match(/^(\d[\d\s]*)$/)
        if (matchSimple) {
          const n = parseInt(matchSimple[1].replace(/\s/g, ''), 10)
          if (!isNaN(n) && n > 0) {
            console.log(`[Viator] CSS nombre seul (${sel}) → ${n}`)
            return n
          }
        }
      }
    } catch {
      // Continuer
    }
  }

  // Stratégie 2 — regex sur le HTML
  try {
    const contenu = await page.content()
    const patterns = [
      /(\d[\d\s]*)\s*activité/i,
      /(\d[\d\s]*)\s*expérience/i,
      /"totalCount"\s*:\s*(\d+)/,
      /"total_results"\s*:\s*(\d+)/,
      /"productCount"\s*:\s*(\d+)/,
    ]
    for (const pattern of patterns) {
      const match = contenu.match(pattern)
      if (match) {
        const n = parseInt(match[1].replace(/\s/g, ''), 10)
        if (!isNaN(n) && n > 0) {
          console.log(`[Viator] Regex (${pattern}) → ${n}`)
          return n
        }
      }
    }
  } catch {
    // Ignorer
  }

  // Stratégie 3 — compter les cartes produits visibles
  try {
    const cartes = await page.$$('[data-test-id="product-card"]')
    if (cartes.length > 0) {
      console.log(`[Viator] Comptage cartes → ${cartes.length}`)
      return cartes.length
    }
  } catch {
    // Ignorer
  }

  return 0
}

/**
 * Scrape Viator pour compter les activités/expériences référencées
 * ⚠️ Viator utilise Cloudflare — retourne 0 si bloqué, sans erreur
 */
export async function scraperViator(browser: Browser, destination: string): Promise<ResultatViator> {
  const debut = Date.now()
  const urls = buildUrlsViator(destination)

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
    // Tenter chaque URL dans l'ordre jusqu'à obtenir un résultat > 0
    for (const { url, slug } of urls) {
      try {
        console.log(`[Viator] Test URL : ${url}`)
        const reponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })

        // Vérifier que la page n'est pas une 404
        if (!reponse?.ok() && reponse?.status() !== 200) {
          console.log(`[Viator] HTTP ${reponse?.status()} → essai suivant`)
          continue
        }

        const total = await extraireNombreViator(page)

        if (total > 0) {
          return {
            total_activites: total,
            url_utilisee: url,
            slug_detecte: slug === 'recherche' ? null : slug,
            duree_ms: Date.now() - debut,
          }
        }

        console.log(`[Viator] 0 résultats → essai URL suivante`)
      } catch {
        console.log(`[Viator] Erreur sur ${url} → essai suivant`)
      }
    }

    // Aucune URL n'a fonctionné
    return {
      total_activites: 0,
      url_utilisee: urls[urls.length - 1].url,
      slug_detecte: null,
      duree_ms: Date.now() - debut,
    }
  } finally {
    await context.close()
  }
}
