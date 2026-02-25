// Route Handler — /api/blocs/stock-en-ligne/viator
// Compte les activités/expériences référencées sur Viator pour une destination

export const runtime = 'nodejs'
export const maxDuration = 120  // 2 minutes

import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { scraperViator } from '@/lib/scrapers/viator'

export async function POST(req: NextRequest) {
  try {
    const { destination }: { destination: string } = await req.json()

    if (!destination) {
      return NextResponse.json({ error: 'destination requise' }, { status: 400 })
    }

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    })

    try {
      const resultat = await scraperViator(browser, destination)
      return NextResponse.json(resultat)
    } finally {
      await browser.close()
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
