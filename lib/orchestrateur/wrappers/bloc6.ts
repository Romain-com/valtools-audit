// Wrapper Bloc 6 — Stock commercialisé en ligne (Airbnb, Booking, Viator, site OT)
// Responsabilité : adapter la signature de lancerBlocStockEnLigne() à l'interface standard
// ⚠️ Nécessite Playwright — doit tourner dans un segment avec runtime 'nodejs'

import { lancerBlocStockEnLigne } from '@/lib/blocs/stock-en-ligne'
import type { ParamsAudit, ResultatBloc } from '../blocs-statuts'
import { lireResultatsBloc, lireBbox } from '../supabase-updates'
import { logInfo } from '../logger'

/**
 * Lance le Bloc 6 et retourne les résultats au format standard de l'orchestrateur.
 * Utilise les stocks physiques du Bloc 5 si disponibles pour les indicateurs croisés.
 */
export async function lancerBloc6(params: ParamsAudit): Promise<ResultatBloc> {
  const domaine_ot = params.domaine_ot ?? ''

  // Lecture des stocks physiques (Bloc 5) pour les indicateurs croisés — optionnel
  let stocks_bloc5: Parameters<typeof lancerBlocStockEnLigne>[1] | undefined

  try {
    const bloc5 = await lireResultatsBloc(params.audit_id, 'stocks_physiques') as {
      stocks?: {
        hebergements?: { total_unique: number }
        activites?: { total_unique: number }
      }
    } | null

    if (bloc5?.stocks) {
      stocks_bloc5 = {
        hebergements_total: bloc5.stocks.hebergements?.total_unique ?? 0,
        activites_total: bloc5.stocks.activites?.total_unique ?? 0,
      }
    }
  } catch {
    // Fallback silencieux — les indicateurs croisés seront à 0
  }

  // Lecture de la bbox prefetchée en Segment A
  // Si absente (microservice était down en Segment A), stock-en-ligne.ts retentera directement
  let bbox_prefetchee: { ne_lat: number; ne_lng: number; sw_lat: number; sw_lng: number } | null = null
  try {
    bbox_prefetchee = await lireBbox(params.audit_id)
  } catch {
    // Fallback silencieux
  }

  const resultat = await lancerBlocStockEnLigne(
    {
      destination: params.nom,
      code_insee: params.code_insee,
      domaine_ot,
      audit_id: params.audit_id,
      // Si null (rien de sauvegardé en Segment A), on passe undefined → fallback microservice dans stock-en-ligne.ts
      ...(bbox_prefetchee !== null ? { bbox: bbox_prefetchee } : {}),
    },
    stocks_bloc5
  )

  // ── Diagnostic — valeurs clés du Bloc 6 ──
  const r = resultat as unknown as Record<string, unknown>
  const airbnb = r.airbnb as Record<string, unknown> | undefined
  const booking = r.booking as Record<string, unknown> | undefined
  const indicateurs = r.indicateurs as Record<string, unknown> | undefined
  logInfo(params.audit_id, 'Bloc 6 — résultats reçus', 'bloc6', {
    domaine_ot_utilise: domaine_ot || 'VIDE',
    airbnb_total: airbnb?.total_annonces ?? null,
    booking_total: booking?.total_annonces ?? null,
    taux_dependance_ota: indicateurs?.taux_dependance_ota ?? null,
    taux_reservable_direct: indicateurs?.taux_reservable_direct ?? null,
  })

  return {
    resultats: resultat as unknown as Record<string, unknown>,
    couts: {
      total: 0.001,
      total_bloc: 0.001,
    },
  }
}
