// Orchestrateur — Bloc 6 : Stock commercialisé en ligne
// Flux : bbox microservice → 4 scrapers en parallèle (browser partagé) → indicateurs → synthèse OpenAI
// Sources : Airbnb, Booking, Viator, site OT (Playwright) + OpenAI

import { chromium } from 'playwright'
import { enregistrerCoutsBloc } from '@/lib/tracking-couts'
import { scraperSiteOT } from '@/lib/scrapers/site-ot'
import { scraperAirbnb } from '@/lib/scrapers/airbnb'
import { scraperBooking } from '@/lib/scrapers/booking'
import { scraperViator } from '@/lib/scrapers/viator'
import type {
  ParamsBloc6,
  ResultatBloc6,
  ResultatSiteOT,
  ResultatAirbnb,
  ResultatBooking,
  ResultatViator,
  IndicateursBloc6,
  BoundingBox,
} from '@/types/stock-en-ligne'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const MICROSERVICE_URL = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────

async function appelRoute<T>(chemin: string, body: object): Promise<T> {
  const reponse = await fetch(`${BASE_URL}${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  })
  if (!reponse.ok) {
    throw new Error(`[${chemin}] Erreur HTTP ${reponse.status}`)
  }
  return reponse.json() as Promise<T>
}

async function getBbox(code_insee: string): Promise<BoundingBox> {
  const reponse = await fetch(`${MICROSERVICE_URL}/bbox?code_insee=${code_insee}`, {
    cache: 'no-store',
  })
  if (!reponse.ok) {
    throw new Error(`[/bbox] Erreur HTTP ${reponse.status} pour ${code_insee}`)
  }
  const data = await reponse.json() as { bbox: BoundingBox }
  return data.bbox
}

// ─── Calcul des indicateurs de croisement ─────────────────────────────────────

function pct(valeur: number, total: number): number {
  if (total === 0) return 0
  return Math.round((valeur / total) * 1000) / 10
}

function calculerIndicateurs(params: {
  ot: ResultatSiteOT | null
  airbnb: ResultatAirbnb | null
  booking: ResultatBooking | null
  viator: ResultatViator | null
  stock_bloc5?: { hebergements_total?: number; activites_total?: number }
}): IndicateursBloc6 {
  const { ot, airbnb, booking, viator, stock_bloc5 } = params

  const total_ota_hebergements =
    (airbnb?.total_annonces ?? 0) + (booking?.total_proprietes ?? 0)

  const stock_hebergements = stock_bloc5?.hebergements_total ?? null
  const stock_activites    = stock_bloc5?.activites_total ?? null

  const site_ot_ota_detectees = [
    ...(ot?.hebergements.liens_ota ?? []),
    ...(ot?.activites.liens_ota ?? []),
  ].filter((v, i, a) => a.indexOf(v) === i)

  return {
    taux_dependance_ota: stock_hebergements !== null && stock_hebergements > 0
      ? pct(total_ota_hebergements, stock_hebergements)
      : null,

    taux_reservable_direct: total_ota_hebergements > 0
      ? pct(ot?.hebergements.nb_fiches ?? 0, total_ota_hebergements)
      : null,

    taux_visibilite_activites: stock_activites !== null && stock_activites > 0
      ? pct(viator?.total_activites ?? 0, stock_activites)
      : null,

    total_ota_hebergements,
    total_ot_hebergements: ot?.hebergements.nb_fiches ?? 0,
    total_ot_activites:    ot?.activites.nb_fiches ?? 0,
    total_viator:          viator?.total_activites ?? 0,

    site_ot_type_hebergements: ot?.hebergements.type ?? 'absent',
    site_ot_type_activites:    ot?.activites.type ?? 'absent',
    site_ot_ota_detectees,
    moteur_resa_detecte:       ot?.moteur_resa_detecte ?? null,
  }
}

// ─── Orchestrateur principal ──────────────────────────────────────────────────

/**
 * Lance le Bloc 6 complet
 * @param params - paramètres de la destination
 * @param stock_bloc5 - optionnel, totaux du bloc 5 pour les taux de croisement
 */
export async function lancerBlocStockEnLigne(
  params: ParamsBloc6,
  stock_bloc5?: { hebergements_total?: number; activites_total?: number }
): Promise<ResultatBloc6> {
  const debut = Date.now()
  const erreurs_partielles: string[] = []

  // Étape 1 — Récupérer la bounding box de la commune
  let bbox: BoundingBox
  try {
    bbox = await getBbox(params.code_insee)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur bbox'
    throw new Error(`Impossible de récupérer la bbox pour ${params.code_insee} : ${msg}`)
  }

  // Étape 2 — Lancer le browser Playwright partagé
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  })

  let ot: ResultatSiteOT | null = null
  let airbnb: ResultatAirbnb | null = null
  let booking: ResultatBooking | null = null
  let viator: ResultatViator | null = null

  try {
    // Étape 3 — 4 scrapers en parallèle (Promise.allSettled — une panne ne bloque pas les autres)
    const [ot_s, airbnb_s, booking_s, viator_s] = await Promise.allSettled([
      scraperSiteOT(browser, params.domaine_ot),
      scraperAirbnb(browser, bbox, params.destination),
      scraperBooking(browser, params.destination),
      scraperViator(browser, params.destination),
    ])

    if (ot_s.status === 'fulfilled') {
      ot = ot_s.value
    } else {
      erreurs_partielles.push(`site_ot: ${ot_s.reason?.message ?? 'erreur inconnue'}`)
    }

    if (airbnb_s.status === 'fulfilled') {
      airbnb = airbnb_s.value
    } else {
      erreurs_partielles.push(`airbnb: ${airbnb_s.reason?.message ?? 'erreur inconnue'}`)
    }

    if (booking_s.status === 'fulfilled') {
      booking = booking_s.value
    } else {
      erreurs_partielles.push(`booking: ${booking_s.reason?.message ?? 'erreur inconnue'}`)
    }

    if (viator_s.status === 'fulfilled') {
      viator = viator_s.value
    } else {
      erreurs_partielles.push(`viator: ${viator_s.reason?.message ?? 'erreur inconnue'}`)
    }
  } finally {
    await browser.close()
  }

  // Étape 4 — Calculer les indicateurs de croisement
  const indicateurs = calculerIndicateurs({ ot, airbnb, booking, viator, stock_bloc5 })

  // Étape 5 — Synthèse OpenAI
  let synthese = null
  let cout_openai = 0
  try {
    const syntheseData = await appelRoute<ReturnType<typeof Object.assign>>('/api/blocs/stock-en-ligne/synthese', {
      destination: params.destination,
      domaine_ot: params.domaine_ot,
      ot,
      airbnb,
      booking,
      viator,
      indicateurs,
    })
    const { cout: _cout, ...syntheseSeule } = syntheseData as { cout: { cout_total: number }; [k: string]: unknown }
    synthese = syntheseSeule as unknown as typeof synthese
    cout_openai = 0.001
  } catch (err: unknown) {
    erreurs_partielles.push(`synthese_openai: ${err instanceof Error ? err.message : 'erreur inconnue'}`)
  }

  // Étape 6 — Tracking des coûts (fire & forget)
  enregistrerCoutsBloc(params.audit_id, 'stock_en_ligne', {
    airbnb_scraping:  { nb_appels: airbnb ? 1 : 0,  cout_unitaire: 0, cout_total: 0 },
    booking_scraping: { nb_appels: booking ? 1 : 0, cout_unitaire: 0, cout_total: 0 },
    viator_scraping:  { nb_appels: viator ? 1 : 0,  cout_unitaire: 0, cout_total: 0 },
    openai_synthese:  { nb_appels: synthese ? 1 : 0, cout_unitaire: 0.001, cout_total: cout_openai },
    total_bloc: cout_openai,
  })

  return {
    site_ot: ot,
    airbnb,
    booking,
    viator,
    indicateurs,
    synthese,
    couts: { openai: cout_openai, scraping: 0 },
    meta: {
      erreurs_partielles,
      duree_totale_ms: Date.now() - debut,
    },
  }
}
