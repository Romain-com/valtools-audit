// Test standalone — Bloc 6 : Stock commercialisé en ligne
// Teste chaque module indépendamment (sans Next.js) puis le flux complet
// Usage : node scripts/test-bloc6.js "Annecy" "74010" "lac-annecy.com"
//
// Pré-requis :
//   - Microservice démarré : cd microservice && npm run dev
//   - Playwright installé : npm install playwright && npx playwright install chromium
//   - .env.local avec OPENAI_API_KEY

require('dotenv').config({ path: '.env.local' })
const axios = require('axios')
const { chromium } = require('playwright')

const destination   = process.argv[2] ?? 'Annecy'
const code_insee    = process.argv[3] ?? '74010'
const domaine_ot    = process.argv[4] ?? 'lac-annecy.com'

const MICROSERVICE_URL = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'
const OPENAI_URL       = 'https://api.openai.com/v1/chat/completions'
const DEBUG            = process.argv.includes('--debug')

function ok(msg) { console.log(`✅ ${msg}`) }
function ko(msg) { console.log(`❌ ${msg}`) }
function info(msg) { console.log(`   ${msg}`) }
function titre(msg) { console.log(`\n─── ${msg} ───`) }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── Module 1 : Bbox (geo.api.gouv.fr direct, sans dépendance microservice) ──

async function testerBbox() {
  titre('1. Bbox (geo.api.gouv.fr)')

  // Essai 1 : contour GeoJSON complet
  const url = `https://geo.api.gouv.fr/communes/${code_insee}?fields=contour,centre&format=json`
  const res = await axios.get(url, { timeout: 10000 })
  const data = res.data

  if (data.contour?.coordinates?.[0]?.length > 0) {
    const coords = data.contour.coordinates[0]
    const lats = coords.map(c => c[1])
    const lngs = coords.map(c => c[0])
    const bbox = {
      ne_lat: Math.max(...lats),
      ne_lng: Math.max(...lngs),
      sw_lat: Math.min(...lats),
      sw_lng: Math.min(...lngs),
    }
    ok(`Bbox ${destination} (${code_insee}) — source: contour`)
    info(`ne_lat: ${bbox.ne_lat.toFixed(4)}, ne_lng: ${bbox.ne_lng.toFixed(4)}`)
    info(`sw_lat: ${bbox.sw_lat.toFixed(4)}, sw_lng: ${bbox.sw_lng.toFixed(4)}`)
    return bbox
  }

  // Fallback : centre + marge 5km
  if (data.centre?.coordinates?.length === 2) {
    const [lng, lat] = data.centre.coordinates
    const marge = 0.05
    const bbox = { ne_lat: lat + marge, ne_lng: lng + marge, sw_lat: lat - marge, sw_lng: lng - marge }
    ok(`Bbox ${destination} (${code_insee}) — source: centre+marge`)
    return bbox
  }

  throw new Error(`Contour introuvable pour ${code_insee}`)
}

// ─── Module 2 : Scraper Airbnb ─────────────────────────────────────────────

async function testerAirbnb(browser, bbox) {
  titre('2. Scraper Airbnb')
  const debut = Date.now()

  // Import dynamique du scraper (TS compilé via ts-node ou transpilé)
  // Pour le test standalone on recrée la logique simplement
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

  const SEUIL_MAX = 1000
  const PROFONDEUR_MAX = 6
  const DELAI_MS = 1800
  let nbRequetes = 0
  let nbZones = 0

  function buildUrl(zone) {
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

  function parseNombre(texte) {
    if (!texte) return null
    const match = texte.replace(/[\s,+]/g, '').match(/\d+/)
    return match ? parseInt(match[0], 10) : null
  }

  async function extraireNombre(p) {
    await p.waitForTimeout(2500)

    // Sélecteurs CSS
    const sels = [
      '[data-testid="listing-count"]',
      '[data-section-id="EXPLORE_STAYS_SECTION_CARD"] h2',
      'h1[data-testid="stays-page-heading"]',
    ]
    for (const sel of sels) {
      try {
        const el = await p.$(sel)
        if (el) {
          const texte = await el.textContent()
          // "1 000+" → forcer découpage
          if (texte && texte.includes('+')) { if (DEBUG) info(`CSS ${sel} → "+" détecté → forcer découpage`); return SEUIL_MAX + 1 }
          const n = parseNombre(texte)
          if (n !== null && n >= 0) { if (DEBUG) info(`CSS ${sel} → ${n}`); return n }
        }
      } catch {}
    }

    // Regex HTML
    const html = await p.content()
    const patterns = [
      /(\d[\d\s]*)\+?\s*logement/i,
      /(\d[\d\s]*)\+?\s*séjour/i,
      /"resultCount"\s*:\s*(\d+)/,
      /Plus de (\d[\d\s]*)\s*logement/i,
    ]
    for (const pat of patterns) {
      const m = html.match(pat)
      if (m) {
        const n = parseNombre(m[1])
        if (n !== null && n > 0) { if (DEBUG) info(`Regex ${pat} → ${n}`); return n }
      }
    }

    // Compter les cartes
    const cartes = await p.$$('[data-testid="card-container"]')
    return cartes.length >= 18 ? 1001 : cartes.length
  }

  function decouper(zone) {
    const midLat = (zone.ne_lat + zone.sw_lat) / 2
    const midLng = (zone.ne_lng + zone.sw_lng) / 2
    return [
      { ne_lat: zone.ne_lat, ne_lng: midLng,      sw_lat: midLat,      sw_lng: zone.sw_lng  },
      { ne_lat: zone.ne_lat, ne_lng: zone.ne_lng,  sw_lat: midLat,      sw_lng: midLng       },
      { ne_lat: midLat,      ne_lng: midLng,       sw_lat: zone.sw_lat, sw_lng: zone.sw_lng  },
      { ne_lat: midLat,      ne_lng: zone.ne_lng,  sw_lat: zone.sw_lat, sw_lng: midLng       },
    ]
  }

  async function compterZone(zone, profondeur = 0) {
    if (profondeur >= PROFONDEUR_MAX) return 0
    await page.goto(buildUrl(zone), { waitUntil: 'domcontentloaded', timeout: 30000 })
    nbRequetes++
    nbZones++
    await page.waitForTimeout(DELAI_MS)

    const n = await extraireNombre(page)
    if (DEBUG) info(`Zone profondeur=${profondeur} → ${n}`)

    if (n >= SEUIL_MAX) {
      const quads = decouper(zone)
      let total = 0
      for (const q of quads) {
        total += await compterZone(q, profondeur + 1)
        await page.waitForTimeout(500)
      }
      return total
    }
    return n
  }

  try {
    const total = await compterZone(bbox)
    ok(`Airbnb — ${total} annonces (${nbRequetes} requêtes, ${nbZones} zones) — ${Date.now() - debut}ms`)
    return { total_annonces: total, nb_requetes: nbRequetes, nb_zones: nbZones, bbox_utilisee: bbox, duree_ms: Date.now() - debut }
  } finally {
    await context.close()
  }
}

// ─── Module 3 : Scraper Booking ────────────────────────────────────────────

async function testerBooking(browser) {
  titre('3. Scraper Booking.com')
  const debut = Date.now()

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  })
  await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2}', r => r.abort())

  const page = await context.newPage()

  function buildUrl(filtre) {
    const base = `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(destination)}&lang=fr&sb=1&src=searchresults&dest_type=city&checkin=2026-07-01&checkout=2026-07-02&group_adults=2&no_rooms=1`
    return filtre ? `${base}&${filtre}` : base
  }

  async function extraireNombre(contexte) {
    await page.waitForTimeout(3000)

    const sels = [
      'h1',
      '[data-testid="property-list-header"]',
      'h1.sr_header',
      '.sorth2',
      '[data-testid="searchresults_header"]',
    ]
    for (const sel of sels) {
      try {
        const el = await page.$(sel)
        if (el) {
          const texte = await el.textContent()
          const m = texte?.match(/(\d[\d\s]*)\s*(établissement|propriété|hébergement|logement|résultat)/i)
          if (m) {
            const n = parseInt(m[1].replace(/\s/g, ''), 10)
            if (!isNaN(n) && n >= 0) { if (DEBUG) info(`[${contexte}] CSS → ${n}`); return n }
          }
        }
      } catch {}
    }

    const html = await page.content()
    const patterns = [/(\d[\d\s]+)\s*établissement/i, /(\d[\d\s]+)\s*propriété/i, /"nb_hotels"\s*:\s*(\d+)/]
    for (const pat of patterns) {
      const m = html.match(pat)
      if (m) {
        const n = parseInt(m[1].replace(/\s/g, ''), 10)
        if (!isNaN(n) && n > 0) { if (DEBUG) info(`[${contexte}] Regex → ${n}`); return n }
      }
    }
    return 0
  }

  async function appel(filtre, contexte) {
    await page.goto(buildUrl(filtre), { waitUntil: 'domcontentloaded', timeout: 30000 })
    return extraireNombre(contexte)
  }

  try {
    // Un seul appel — le filtre ht_id ne change pas le compteur h1
    const total = await appel(undefined, 'total')

    ok(`Booking — ${total} propriétés — ${Date.now() - debut}ms`)
    return { total_proprietes: total, detail: { hotels: 0, apparts: 0, campings: 0, bb: 0, villas: 0 }, duree_ms: Date.now() - debut }
  } finally {
    await context.close()
  }
}

// ─── Module 4 : Scraper Viator ─────────────────────────────────────────────

async function testerViator(browser) {
  titre('4. Scraper Viator')
  const debut = Date.now()

  const slug = destination.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const urls = [
    `https://www.viator.com/fr-FR/${slug}/d-ddaa/`,
    `https://www.viator.com/fr-FR/${slug.charAt(0).toUpperCase() + slug.slice(1)}/d-ddaa/`,
    `https://www.viator.com/fr-FR/search?q=${encodeURIComponent(destination)}`,
  ]

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  })
  await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2}', r => r.abort())

  const page = await context.newPage()

  async function extraireNombre() {
    await page.waitForTimeout(3000)
    const sels = ['[data-test-id="results-count"]', '[class*="resultsCount"]', '[class*="product-count"]']
    for (const sel of sels) {
      try {
        const el = await page.$(sel)
        if (el) {
          const texte = await el.textContent()
          const m = texte?.match(/(\d[\d\s]*)\s*(activité|expérience|visite|tour|résultat)/i)
          if (m) return parseInt(m[1].replace(/\s/g, ''), 10)
        }
      } catch {}
    }
    const html = await page.content()
    const patterns = [/(\d[\d\s]*)\s*activité/i, /(\d[\d\s]*)\s*expérience/i, /"totalCount"\s*:\s*(\d+)/]
    for (const pat of patterns) {
      const m = html.match(pat)
      if (m) {
        const n = parseInt(m[1].replace(/\s/g, ''), 10)
        if (n > 0) return n
      }
    }
    const cartes = await page.$$('[data-test-id="product-card"]')
    return cartes.length
  }

  try {
    for (const url of urls) {
      try {
        if (DEBUG) info(`Test URL : ${url}`)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
        const n = await extraireNombre()
        if (n > 0) {
          ok(`Viator — ${n} activités (URL: ${url}) — ${Date.now() - debut}ms`)
          return { total_activites: n, url_utilisee: url, slug_detecte: slug, duree_ms: Date.now() - debut }
        }
      } catch {}
    }
    ok(`Viator — 0 activités (destination non référencée ?) — ${Date.now() - debut}ms`)
    return { total_activites: 0, url_utilisee: urls[0], slug_detecte: null, duree_ms: Date.now() - debut }
  } finally {
    await context.close()
  }
}

// ─── Module 5 : Scraper Site OT ────────────────────────────────────────────

async function testerSiteOT(browser) {
  titre('5. Scraper Site OT')
  const debut = Date.now()

  const PATTERNS_HEBERGEMENTS = ['/hebergements', '/hebergement', '/ou-dormir', '/logements', '/hotels', '/locations']
  const PATTERNS_ACTIVITES = ['/activites', '/activite', '/que-faire', '/loisirs', '/experiences', '/visites']

  const SIGNAUX_MOTEURS = ['bokun', 'regiondo', 'fareharbor', 'checkfront', 'rezdy']
  const SIGNAUX_OTA = [
    { pat: 'booking.com', nom: 'booking' },
    { pat: 'airbnb', nom: 'airbnb' },
    { pat: 'viator.com', nom: 'viator' },
    { pat: 'getyourguide', nom: 'getyourguide' },
    { pat: 'tripadvisor', nom: 'tripadvisor' },
  ]

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'fr-FR',
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  })
  await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2}', r => r.abort())
  await context.route('**/analytics**', r => r.abort())

  const page = await context.newPage()

  async function trouverUrl(patterns) {
    for (const p of patterns) {
      const url = `https://${domaine_ot}${p}`
      try {
        const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 })
        if (r?.ok()) return url
      } catch {}
    }
    return null
  }

  async function analyser() {
    await page.waitForTimeout(2000)
    const html = await page.content()

    // Moteur de réservation
    let est_reservable_direct = false
    let moteur = null
    for (const m of SIGNAUX_MOTEURS) {
      if (html.includes(m)) { est_reservable_direct = true; moteur = m; break }
    }
    // Calendrier
    if (!est_reservable_direct) {
      const el = await page.$('input[type="date"]')
      if (el) est_reservable_direct = true
    }

    // Liens OTA
    const liens_ota = []
    for (const { pat, nom } of SIGNAUX_OTA) {
      if (html.includes(pat) && !liens_ota.includes(nom)) liens_ota.push(nom)
    }

    // Compter fiches
    let nb_fiches = 0
    for (const sel of ['[class*="card"]', '[class*="listing"]', 'article']) {
      try {
        const els = await page.$$(sel)
        if (els.length > nb_fiches) nb_fiches = els.length
      } catch {}
    }

    return { est_reservable_direct, liens_ota, nb_fiches, moteur }
  }

  function classifier(url, a) {
    if (!url || !a || a.nb_fiches === 0) return 'absent'
    if (a.est_reservable_direct) return 'reservable_direct'
    if (a.liens_ota.length > 0) return 'lien_ota'
    return 'listing_seul'
  }

  try {
    const url_heb = await trouverUrl(PATTERNS_HEBERGEMENTS)
    let ah = null
    if (url_heb) { ah = await analyser() }

    const url_act = await trouverUrl(PATTERNS_ACTIVITES)
    let aa = null
    if (url_act) { aa = await analyser() }

    const moteur = ah?.moteur || aa?.moteur || null

    ok(`Site OT ${domaine_ot} — Hébergements: ${url_heb ? classifier(url_heb, ah) : 'absent'} (${ah?.nb_fiches ?? 0} fiches, OTA: ${ah?.liens_ota?.join(',') || 'aucune'})`)
    ok(`Site OT ${domaine_ot} — Activités: ${url_act ? classifier(url_act, aa) : 'absent'} (${aa?.nb_fiches ?? 0} fiches, OTA: ${aa?.liens_ota?.join(',') || 'aucune'})`)
    if (moteur) info(`Moteur de réservation détecté : ${moteur}`)
    info(`Durée : ${Date.now() - debut}ms`)

    return {
      domaine: domaine_ot,
      url_hebergements: url_heb,
      url_activites: url_act,
      hebergements: { nb_fiches: ah?.nb_fiches ?? 0, est_reservable_direct: ah?.est_reservable_direct ?? false, liens_ota: ah?.liens_ota ?? [], type: classifier(url_heb, ah) },
      activites: { nb_fiches: aa?.nb_fiches ?? 0, est_reservable_direct: aa?.est_reservable_direct ?? false, liens_ota: aa?.liens_ota ?? [], type: classifier(url_act, aa) },
      moteur_resa_detecte: moteur,
      duree_ms: Date.now() - debut,
    }
  } finally {
    await context.close()
  }
}

// ─── Module 6 : Synthèse OpenAI ────────────────────────────────────────────

async function testerSynthese(ot, airbnb, booking, viator) {
  titre('6. Synthèse OpenAI')

  const total_ota = (airbnb?.total_annonces ?? 0) + (booking?.total_proprietes ?? 0)
  const indicateurs = {
    taux_dependance_ota: null,
    taux_reservable_direct: total_ota > 0 ? Math.round(((ot?.hebergements.nb_fiches ?? 0) / total_ota) * 1000) / 10 : null,
    taux_visibilite_activites: null,
    total_ota_hebergements: total_ota,
    total_ot_hebergements: ot?.hebergements.nb_fiches ?? 0,
    total_ot_activites: ot?.activites.nb_fiches ?? 0,
    total_viator: viator?.total_activites ?? 0,
    site_ot_type_hebergements: ot?.hebergements.type ?? 'absent',
    site_ot_type_activites: ot?.activites.type ?? 'absent',
    site_ot_ota_detectees: [...(ot?.hebergements.liens_ota ?? []), ...(ot?.activites.liens_ota ?? [])].filter((v, i, a) => a.indexOf(v) === i),
    moteur_resa_detecte: ot?.moteur_resa_detecte ?? null,
  }

  const prompt = `Tu es expert en tourisme digital français. Analyse les données de commercialisation en ligne de ${destination}.

Site OT (${domaine_ot}) :
- Hébergements : ${ot?.hebergements.nb_fiches ?? 0} fiches (type: ${ot?.hebergements.type ?? 'absent'})
- Activités : ${ot?.activites.nb_fiches ?? 0} fiches (type: ${ot?.activites.type ?? 'absent'})
- OTA détectées : ${indicateurs.site_ot_ota_detectees.join(', ') || 'aucune'}
- Moteur de réservation : ${indicateurs.moteur_resa_detecte ?? 'non détecté'}

OTA :
- Airbnb : ${airbnb?.total_annonces ?? 'N/A'} annonces
- Booking : ${booking?.total_proprietes ?? 'N/A'} propriétés
- Viator : ${viator?.total_activites ?? 'N/A'} activités
- Total OTA hébergements : ${total_ota}
- Taux réservable direct OT : ${indicateurs.taux_reservable_direct ?? 'N/A'}%

Réponds UNIQUEMENT avec un JSON valide :
{"diagnostic":"...","points_cles":[{"label":"...","valeur":"...","niveau":"bon|moyen|critique"}],"message_ot":"...","recommandations":["...","...","..."]}`

  const reponse = await axios.post(OPENAI_URL, {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 600,
  }, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 45000,
  })

  const brut = reponse.data.choices?.[0]?.message?.content ?? ''
  const synthese = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())

  ok('Synthèse OpenAI générée')
  info(`Diagnostic : ${synthese.diagnostic?.substring(0, 100)}...`)
  info(`Message OT : ${synthese.message_ot}`)
  info(`Recommandations : ${synthese.recommandations?.length} items`)

  return synthese
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`TEST BLOC 6 — Stock commercialisé en ligne`)
  console.log(`Destination : ${destination} (INSEE: ${code_insee})`)
  console.log(`Site OT     : ${domaine_ot}`)
  console.log(`${'═'.repeat(60)}`)

  // Vérifier microservice
  try {
    await axios.get(`${MICROSERVICE_URL}/health`, { timeout: 3000 })
    ok('Microservice accessible')
  } catch {
    ko('Microservice inaccessible — démarrer avec : cd microservice && npm run dev')
    process.exit(1)
  }

  const debutTotal = Date.now()

  // Module 1 : Bbox
  let bbox
  try {
    bbox = await testerBbox()
  } catch (err) {
    ko(`Bbox échoué : ${err.message}`)
    process.exit(1)
  }

  // Démarrer le browser Playwright partagé
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  })
  console.log('\n🎭 Browser Playwright démarré (headless)')

  let airbnb, booking, viator, ot

  try {
    // Modules 2-5 en séquence (pas en parallèle dans le script de test — plus lisible)
    // Note : dans l'orchestrateur de production, ils tournent en parallèle
    try { airbnb  = await testerAirbnb(browser, bbox) }
    catch (err) { ko(`Airbnb échoué : ${err.message}`); airbnb = null }

    try { booking = await testerBooking(browser) }
    catch (err) { ko(`Booking échoué : ${err.message}`); booking = null }

    try { viator  = await testerViator(browser) }
    catch (err) { ko(`Viator échoué : ${err.message}`); viator = null }

    try { ot = await testerSiteOT(browser) }
    catch (err) { ko(`Site OT échoué : ${err.message}`); ot = null }

  } finally {
    await browser.close()
    console.log('\n🎭 Browser Playwright fermé')
  }

  // Module 6 : Synthèse OpenAI
  let synthese
  try { synthese = await testerSynthese(ot, airbnb, booking, viator) }
  catch (err) { ko(`Synthèse OpenAI échouée : ${err.message}`) }

  // ─── Résumé ───────────────────────────────────────────────────────────────
  titre('RÉSUMÉ')

  const total_ota = (airbnb?.total_annonces ?? 0) + (booking?.total_proprietes ?? 0)

  console.log('\nDONNÉES COLLECTÉES :')
  info(`Airbnb          : ${airbnb?.total_annonces ?? 'ERREUR'} annonces`)
  info(`Booking         : ${booking?.total_proprietes ?? 'ERREUR'} propriétés`)
  info(`  → Total OTA   : ${total_ota} hébergements`)
  info(`Viator          : ${viator?.total_activites ?? 'ERREUR'} activités`)
  info(`Site OT (héb.)  : ${ot?.hebergements.nb_fiches ?? 'ERREUR'} fiches — type: ${ot?.hebergements.type ?? '?'}`)
  info(`Site OT (act.)  : ${ot?.activites.nb_fiches ?? 'ERREUR'} fiches — type: ${ot?.activites.type ?? '?'}`)

  if (total_ota > 0 && ot?.hebergements.nb_fiches !== undefined) {
    const taux = Math.round((ot.hebergements.nb_fiches / total_ota) * 1000) / 10
    info(`Taux réservable direct OT : ${taux}% (${ot.hebergements.nb_fiches} fiches OT / ${total_ota} OTA)`)
  }

  console.log('\nCOÛT TOTAL : 0.001€ (OpenAI uniquement)')
  console.log(`DURÉE TOTALE : ${Math.round((Date.now() - debutTotal) / 1000)}s`)

  // Checklist
  titre('CHECKLIST')
  const checks = [
    ['Bbox récupérée', !!bbox],
    ['Airbnb > 0', (airbnb?.total_annonces ?? 0) > 0],
    ['Booking > 0', (booking?.total_proprietes ?? 0) > 0],
    ['Viator analysé', viator !== null],
    ['Site OT analysé', ot !== null],
    ['Synthèse OpenAI générée', !!synthese],
    ['Durée < 10 min', (Date.now() - debutTotal) < 600000],
  ]
  for (const [label, ok_] of checks) {
    console.log(`${ok_ ? '✅' : '❌'} ${label}`)
  }
}

main().catch(err => {
  console.error('\n❌ Erreur fatale :', err.message)
  if (DEBUG) console.error(err.stack)
  process.exit(1)
})
