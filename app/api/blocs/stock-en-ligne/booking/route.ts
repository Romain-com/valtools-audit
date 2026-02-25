// Route Handler — /api/blocs/stock-en-ligne/booking
// Compte les propriétés hébergement sur Booking.com pour une destination

export const runtime = 'nodejs'
export const maxDuration = 120  // 2 minutes

import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { scraperBooking } from '@/lib/scrapers/booking'

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
      const resultat = await scraperBooking(browser, destination)
      return NextResponse.json(resultat)
    } finally {
      await browser.close()
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
