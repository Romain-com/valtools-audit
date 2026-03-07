// Route POST /api/territoire/ota
// Scrape Airbnb + Booking pour une liste de communes.
// Appelée séparément de l'analyse principale pour ne pas bloquer l'affichage des résultats.
// Retourne les données OTA par code_insee.

export const runtime = 'nodejs'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { scraperAirbnb } from '@/lib/scrapers/airbnb'
import { scraperBooking } from '@/lib/scrapers/booking'
import type { ResultatAirbnb, ResultatBooking } from '@/types/stock-en-ligne'

interface CommuneOTA {
  nom: string
  code_insee: string
}

interface ResultatOTA {
  code_insee: string
  airbnb: ResultatAirbnb | null
  booking: ResultatBooking | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const communes: CommuneOTA[] = body.communes ?? []

    if (!Array.isArray(communes) || communes.length === 0) {
      return NextResponse.json({ error: 'Paramètre communes requis' }, { status: 400 })
    }

    const resultats: ResultatOTA[] = []

    // Un seul browser partagé — scraping séquentiel par commune
    let browser: import('playwright').Browser | null = null
    try {
      const { chromium } = await import('playwright')
      // headless: false — nécessaire pour que la carte Airbnb (WebGL/canvas) se rende correctement
      // et que l'autocomplete fonctionne (DOM dynamique). App locale uniquement.
      browser = await chromium.launch({ headless: false, slowMo: 50 })

      for (const commune of communes) {
        try {
          // Airbnb + Booking lancés en parallèle pour chaque commune
          const [airbnb, booking] = await Promise.all([
            scraperAirbnb(browser, commune.nom, commune.code_insee),
            scraperBooking(browser, commune.nom),
          ])
          resultats.push({ code_insee: commune.code_insee, airbnb, booking })
        } catch (err) {
          console.error(`[OTA] Erreur scraping ${commune.nom} :`, err instanceof Error ? err.message : err)
          resultats.push({ code_insee: commune.code_insee, airbnb: null, booking: null })
        }
      }
    } catch (err) {
      console.error('[OTA] Playwright indisponible :', err instanceof Error ? err.message : err)
      // Retourner des nulls pour toutes les communes si Playwright ne démarre pas
      for (const commune of communes) {
        if (!resultats.find((r) => r.code_insee === commune.code_insee)) {
          resultats.push({ code_insee: commune.code_insee, airbnb: null, booking: null })
        }
      }
    } finally {
      if (browser) await browser.close()
    }

    return NextResponse.json({ resultats })
  } catch (err) {
    console.error('[OTA] Erreur :', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
