// Route Handler — Apify Instagram
// Responsabilité : récupérer les stats de hashtag et les posts récents via Apify
// ⚠️  Serveur uniquement — aucune clé API exposée côté client

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import type { ResultatInstagram, PostInstagram } from '@/types/positionnement'

// Timeout généreux — Apify run-sync peut prendre jusqu'à 2 minutes
const TIMEOUT_MS = 120_000

// Coût unitaire par appel Apify (en euros)
const COUT_UNITAIRE = 0.05

// ─── Types internes Apify ────────────────────────────────────────────────────

interface ApifyHashtagStats {
  hashtag?: string
  postsCount?: number
  mediaCount?: number
}

interface ApifyPost {
  likesCount?: number
  ownerUsername?: string
  timestamp?: string
  caption?: string
}

/**
 * Construit l'URL Apify run-sync pour un acteur donné.
 */
function urlApify(acteur: string, token: string, timeoutSec = 90): string {
  return (
    `https://api.apify.com/v2/acts/${acteur}/run-sync-get-dataset-items` +
    `?token=${token}&timeout=${timeoutSec}`
  )
}

/**
 * Détermine si un post provient d'un compte OT/institutionnel.
 * Heuristique : username contient "tourisme", "ot_", ou le nom de la destination.
 */
function estCompteOT(username: string, destination: string): boolean {
  const u = username.toLowerCase()
  const dest = destination.toLowerCase().replace(/\s+/g, '')
  return u.includes('tourisme') || u.includes('ot_') || u.includes(dest)
}

/**
 * Calcule le ratio OT/UGC sur les posts récents.
 * Retourne une chaîne au format "X/10".
 */
function calculerRatioOTUGC(posts: PostInstagram[], destination: string): string {
  const nbOT = posts.filter((p) => estCompteOT(p.username, destination)).length
  return `${nbOT}/${posts.length}`
}

export async function POST(request: NextRequest) {
  // Lecture du body
  const body = await request.json().catch(() => ({}))
  const { hashtag } = body as { hashtag?: string }

  if (!hashtag) {
    return NextResponse.json({ erreur: 'Paramètre hashtag manquant' }, { status: 400 })
  }

  const token = process.env.APIFY_API_TOKEN

  if (!token) {
    return NextResponse.json({ erreur: 'Variable APIFY_API_TOKEN manquante' }, { status: 500 })
  }

  // ─── Appel 1 : stats du hashtag (postsCount) ─────────────────────────────
  let postsCount: number | null = null
  let erreurStats = false

  try {
    const response = await axios.post<ApifyHashtagStats[]>(
      urlApify('apify~instagram-hashtag-stats', token),
      { hashtags: [hashtag], maxItems: 1 },
      { timeout: TIMEOUT_MS }
    )

    const data = response.data?.[0]
    // Le champ peut s'appeler postsCount ou mediaCount selon la version de l'acteur
    postsCount = data?.postsCount ?? data?.mediaCount ?? null
  } catch (err) {
    // Fallback : on continue sans le postsCount
    console.error('[Instagram] Erreur hashtag-stats :', err)
    erreurStats = true
  }

  // ─── Appel 2 : posts récents ──────────────────────────────────────────────
  let postsRecents: PostInstagram[] = []
  let erreurPosts = false

  try {
    const response = await axios.post<ApifyPost[]>(
      urlApify('apify~instagram-hashtag-scraper', token),
      { hashtags: [hashtag], resultsLimit: 10 },
      { timeout: TIMEOUT_MS }
    )

    // Normalisation des posts récupérés
    postsRecents = (response.data ?? []).map((item) => ({
      likes: item.likesCount ?? 0,
      username: item.ownerUsername ?? '',
      timestamp: item.timestamp ?? '',
      caption: item.caption ?? '',
    }))
  } catch (err) {
    // Fallback : on retourne un tableau vide + flag d'erreur
    console.error('[Instagram] Erreur hashtag-scraper :', err)
    erreurPosts = true
  }

  // ─── Calcul du ratio OT/UGC ──────────────────────────────────────────────
  const ratioOTUGC =
    postsRecents.length > 0 ? calculerRatioOTUGC(postsRecents, hashtag) : '0/0'

  // ─── Construction de la réponse ──────────────────────────────────────────
  const resultat: ResultatInstagram & { erreur_stats?: boolean; erreur_posts?: boolean } = {
    hashtag,
    posts_count: postsCount,
    posts_recents: postsRecents,
    ratio_ot_ugc: ratioOTUGC,
    cout: {
      nb_appels: 2,
      cout_unitaire: COUT_UNITAIRE,
      cout_total: COUT_UNITAIRE * 2,
    },
    // Flags de dégradation partielle
    ...(erreurStats && { erreur_stats: true }),
    ...(erreurPosts && { erreur_posts: true }),
  }

  return NextResponse.json(resultat)
}
