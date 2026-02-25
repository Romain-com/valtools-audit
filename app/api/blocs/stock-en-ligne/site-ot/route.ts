// Route Handler — /api/blocs/stock-en-ligne/site-ot
// Analyse le site de l'office de tourisme (section hébergements + activités)
// Utilise Playwright pour détecter réservable direct / lien OTA / listing seul

export const runtime = 'nodejs'
export const maxDuration = 120  // 2 minutes max

import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { scraperSiteOT } from '@/lib/scrapers/site-ot'

export async function POST(req: NextRequest) {
  try {
    const { domaine_ot }: { domaine_ot: string } = await req.json()

    if (!domaine_ot) {
      return NextResponse.json({ error: 'domaine_ot requis' }, { status: 400 })
    }

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    })

    try {
      const resultat = await scraperSiteOT(browser, domaine_ot)
      return NextResponse.json(resultat)
    } finally {
      await browser.close()
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
