// Route Handler — DataForSEO SERP organique
// Responsabilité : récupérer les top 3 résultats Google pour 5 intentions de recherche
//   et fusionner l'ensemble en dédupliquant par domaine
// ⚠️  Serveur uniquement — aucune clé API exposée côté client
// ⚠️  5 appels en parallèle — filtrer item.type === 'organic' uniquement

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

// URL de l'API DataForSEO SERP organique
const DATAFORSEO_URL = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced'

// Timeout par appel
const TIMEOUT_MS = 60_000

// ─── Types internes DataForSEO ───────────────────────────────────────────────

interface DataForSEOItem {
  type: string
  rank_absolute?: number
  url?: string
  domain?: string
  title?: string
  description?: string
}

interface DataForSEOResponse {
  tasks?: Array<{
    result?: Array<{ items?: DataForSEOItem[] }>
  }>
}

// ─── Types de retour ──────────────────────────────────────────────────────────

interface ItemSERPBrut {
  position: number
  url: string
  domaine: string
  titre: string
  meta_description: string
  requete_source: string
}

interface RequeteResultat {
  requete: string
  keyword: string
  top3: ItemSERPBrut[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrait les résultats organiques depuis une réponse DataForSEO.
 * ⚠️ Ne jamais utiliser d'index fixe — itérer sur tous les items.
 */
function extraireOrganiques(
  items: DataForSEOItem[],
  requete_source: string,
  limite: number
): ItemSERPBrut[] {
  return items
    .filter((item) => item.type === 'organic')
    .slice(0, limite)
    .map((item) => ({
      position: item.rank_absolute ?? 0,
      url: item.url ?? '',
      domaine: item.domain ?? '',
      titre: item.title ?? '',
      meta_description: item.description ?? '',
      requete_source,
    }))
}

/**
 * Fusionne N listes de résultats SERP et déduplique par domaine.
 * En cas de doublon, conserve la position la plus basse (= meilleure).
 * Trie par position croissante.
 */
function fusionnerEtDedupliquer(listes: ItemSERPBrut[][]): ItemSERPBrut[] {
  const parDomaine = new Map<string, ItemSERPBrut>()

  for (const item of listes.flat()) {
    if (!item.domaine) continue
    const existant = parDomaine.get(item.domaine)
    if (!existant || item.position < existant.position) {
      parDomaine.set(item.domaine, item)
    }
  }

  return Array.from(parDomaine.values()).sort((a, b) => a.position - b.position)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { destination } = body as { destination?: string }

  if (!destination) {
    return NextResponse.json({ erreur: 'Paramètre destination manquant' }, { status: 400 })
  }

  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD

  if (!login || !password) {
    return NextResponse.json(
      { erreur: 'Variables DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD manquantes' },
      { status: 500 }
    )
  }

  // Auth Basic DataForSEO via objet axios
  const auth = { username: login, password }

  // ─── Définition des 5 intentions de recherche ─────────────────────────────
  const requetes = [
    { cle: 'destination',  keyword: destination },
    { cle: 'tourisme',     keyword: `${destination} tourisme` },
    { cle: 'hebergement',  keyword: `hébergement ${destination}` },
    { cle: 'que_faire',    keyword: `que faire ${destination}` },
    { cle: 'restaurant',   keyword: `restaurant ${destination}` },
  ]

  // ─── 5 appels en parallèle ────────────────────────────────────────────────
  const reponses = await Promise.all(
    requetes.map(({ cle, keyword }) =>
      axios
        .post<DataForSEOResponse>(
          DATAFORSEO_URL,
          [{ keyword, language_code: 'fr', location_code: 2250, depth: 10 }],
          { auth, timeout: TIMEOUT_MS }
        )
        .then((res) => {
          const items = res.data.tasks?.[0]?.result?.[0]?.items ?? []
          return {
            requete: cle,
            keyword,
            top3: extraireOrganiques(items, cle, 3),
          } as RequeteResultat
        })
        .catch((err) => {
          // Erreur sur une requête — retourner vide sans bloquer les autres
          console.error(`[SERP] Erreur requête "${keyword}" :`, err.message)
          return { requete: cle, keyword, top3: [] } as RequeteResultat
        })
    )
  )

  // ─── Fusion et déduplication de tous les résultats ────────────────────────
  const tous_resultats = fusionnerEtDedupliquer(reponses.map((r) => r.top3))

  return NextResponse.json({
    par_requete: reponses,
    tous_resultats,
  })
}
