// Scraper — Airbnb
// Compte les annonces hébergement actives sur Airbnb pour une commune
// Stratégie : simulation de l'interaction utilisateur (saisie + autocomplete)
// → seule approche fiable pour obtenir les résultats ancrés à la commune

import type { Browser, Page } from 'playwright'
import type { ResultatAirbnb } from '@/types/stock-en-ligne'

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
      console.log(`[Airbnb] Stratégie comptage cartes → ${cartes.length}`)
      return cartes.length
    }
  } catch {
    // Ignorer
  }

  console.log('[Airbnb] Aucune stratégie n\'a fonctionné → 0')
  return 0
}

/**
 * Simule une recherche utilisateur sur Airbnb :
 * saisit le nom de la destination, sélectionne la première suggestion autocomplete,
 * puis lit le nombre d'annonces affiché.
 * C'est la seule approche qui retourne un résultat ancré à la commune (comme une recherche manuelle).
 */
async function rechercherViaAutocomplete(page: Page, destination: string): Promise<number> {
  // Page d'accueil Airbnb
  await page.goto('https://www.airbnb.fr', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)

  // Fermer la bannière cookies si présente
  try {
    const btnCookies = await page.$('[data-testid="accept-btn"], button:has-text("Accepter"), button:has-text("Tout accepter")')
    if (btnCookies) await btnCookies.click()
    await page.waitForTimeout(500)
  } catch { /* ignorer */ }

  // Remplir le champ destination (plusieurs sélecteurs possibles selon version Airbnb)
  const champSels = [
    '[data-testid="structured-search-input-field-query"]',
    '#bigsearch-query-location-input',
    'input[placeholder*="estination"]',
    'input[name="query"]',
  ]
  let champTrouve = false
  for (const sel of champSels) {
    try {
      const champ = await page.$(sel)
      if (champ) {
        await champ.click()
        await page.waitForTimeout(300)
        await champ.fill(destination)
        champTrouve = true
        break
      }
    } catch { /* continuer */ }
  }
  if (!champTrouve) throw new Error('Champ destination non trouvé')

  // Attendre l'apparition de la liste de suggestions autocomplete
  const suggSels = [
    '[data-testid="option-0-label"]',
    '[data-testid="option-0"]',
    '[role="option"]:first-child',
    'li[id*="option-0"]',
  ]
  let suggTrouvee = false
  // Attendre que la dropdown soit visible (jusqu'à 5s)
  for (const sel of suggSels) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 })
      await page.click(sel)
      suggTrouvee = true
      break
    } catch { /* continuer avec le prochain sélecteur */ }
  }

  if (!suggTrouvee) {
    // Fallback : flèche bas + Entrée pour valider la première suggestion
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(500)
    await page.keyboard.press('Enter')
  }

  await page.waitForTimeout(1000)

  // Lancer la recherche
  const btnSels = [
    '[data-testid="structured-search-input-search-button"]',
    'button[type="submit"]',
    'button[aria-label*="echercher"]',
  ]
  for (const sel of btnSels) {
    try {
      const btn = await page.$(sel)
      if (btn) { await btn.click(); break }
    } catch { /* continuer */ }
  }

  // Attendre le chargement initial des résultats (affiche 1000+ à ce stade)
  await page.waitForTimeout(3500)

  // Dézoom sur la carte pour déclencher le recalcul ancré à la commune
  // Airbnb affiche 1000+ au chargement (search par nom large) puis après dézoom
  // la carte déclenche search_by_map=true sur la zone visible → vrai nombre de la commune
  await dezoomCarte(page)

  return extraireNombreAirbnb(page)
}

/**
 * Effectue un dézoom sur la carte Airbnb pour déclencher le recalcul du nombre d'annonces.
 * Airbnb affiche 1000+ au chargement initial, puis recalcule après interaction avec la carte.
 */
async function dezoomCarte(page: Page): Promise<void> {
  try {
    // Tentative 1 — bouton zoom- de la carte
    const btnSelectors = [
      'button[aria-label="Zoom out"]',
      'button[aria-label="Réduire le zoom"]',
      'button[aria-label="Dézoomer"]',
      '[data-testid="map-zoom-out-button"]',
      '[class*="zoomOut"]',
      '[title="Zoom out"]',
    ]
    for (const sel of btnSelectors) {
      try {
        const btn = await page.$(sel)
        if (btn) {
          await btn.click()
          console.log(`[Airbnb] Dézoom via bouton (${sel})`)
          await page.waitForTimeout(2500)
          return
        }
      } catch { /* continuer */ }
    }

    // Tentative 2 — scroll molette vers le bas sur la carte
    const mapSelectors = [
      '[data-veloute="map/GoogleMap"]',
      '[data-section-id="MAP_DEFAULT_CONTROLLER"]',
      '[class*="GoogleMap"]',
      '#map',
      'canvas',  // Airbnb utilise un canvas WebGL pour la carte
    ]
    for (const sel of mapSelectors) {
      try {
        const mapEl = await page.$(sel)
        if (mapEl) {
          const box = await mapEl.boundingBox()
          if (box && box.width > 100 && box.height > 100) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
            // Scroll vers le bas = zoom out sur les cartes web
            await page.mouse.wheel(0, 150)
            console.log(`[Airbnb] Dézoom via scroll molette (${sel})`)
            await page.waitForTimeout(2500)
            return
          }
        }
      } catch { /* continuer */ }
    }

    console.warn('[Airbnb] Dézoom : aucun contrôle de carte trouvé — résultat peut être inexact')
  } catch (err) {
    console.warn('[Airbnb] Dézoom échoué :', err instanceof Error ? err.message : err)
  }
}

/**
 * Scrape Airbnb pour compter les annonces hébergement sur la commune.
 * Simule une interaction utilisateur complète pour obtenir un résultat ancré à la commune.
 */
export async function scraperAirbnb(
  browser: Browser,
  destination: string,
  code_insee: string  // conservé pour compatibilité — non utilisé dans cette stratégie
): Promise<ResultatAirbnb> {
  const debut = Date.now()

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  })

  // Bloquer ressources inutiles (images, fonts, tracking)
  await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2}', r => r.abort())
  await context.route('**/analytics**', r => r.abort())
  await context.route('**/tracking**', r => r.abort())
  await context.route('**/sentry**', r => r.abort())

  const page = await context.newPage()

  try {
    const total_annonces = await rechercherViaAutocomplete(page, destination)
    console.log(`[Airbnb] ${destination} → ${total_annonces} annonces`)

    return {
      total_annonces,
      nb_requetes: 1,
      duree_ms: Date.now() - debut,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Airbnb] Erreur pour ${destination} :`, message)
    return {
      total_annonces: 0,
      nb_requetes: 1,
      duree_ms: Date.now() - debut,
      erreur: message,
    }
  } finally {
    await context.close()
  }
}
