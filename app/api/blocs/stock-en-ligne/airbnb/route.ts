// Route Handler — /api/blocs/stock-en-ligne/airbnb
// Compte les annonces hébergement Airbnb pour une commune (découpage géographique en quadrants)

export const runtime = 'nodejs'
export const maxDuration = 300  // 5 minutes — Airbnb peut prendre longtemps sur les grandes villes

import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { scraperAirbnb } from '@/lib/scrapers/airbnb'
import type { BoundingBox } from '@/types/stock-en-ligne'

export async function POST(req: NextRequest) {
  try {
    const {
      bbox,
      destination,
    }: { bbox: BoundingBox; destination: string } = await req.json()

    if (!bbox || !destination) {
      return NextResponse.json({ error: 'bbox et destination requis' }, { status: 400 })
    }

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    })

    try {
      const resultat = await scraperAirbnb(browser, bbox, destination)
      return NextResponse.json(resultat)
    } finally {
      await browser.close()
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
