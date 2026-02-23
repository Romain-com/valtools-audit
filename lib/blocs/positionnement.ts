// Orchestrateur — Bloc 1 : Positionnement & Notoriété
// Responsabilité : appeler les 3 modules en séquence et agréger les résultats
// Utilisé côté serveur uniquement (Server Actions, Route Handlers, scripts)

import type {
  ResultatMaps,
  ResultatInstagram,
  AnalysePositionnement,
  AnalysePositionnementErreur,
  ResultatBlocPositionnement,
} from '@/types/positionnement'

// URL de base — à adapter selon l'environnement (dev / prod)
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/**
 * Appelle une route API interne avec un body JSON.
 * Utilise fetch natif Next.js pour bénéficier du cache et des optimisations App Router.
 */
async function appelRoute<T>(chemin: string, body: object): Promise<T> {
  const response = await fetch(`${BASE_URL}${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Pas de cache — les données d'audit doivent toujours être fraîches
    cache: 'no-store',
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`[${chemin}] Erreur HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

/**
 * Point d'entrée du Bloc 1 — Positionnement & Notoriété.
 *
 * @param destination - Nom de la destination (ex: "Annecy")
 * @param hashtag     - Hashtag Instagram sans # (ex: "annecy")
 * @returns           - Objet agrégé avec les données Google, Instagram, l'analyse IA et le coût total
 */
export async function auditPositionnement(
  destination: string,
  hashtag: string
): Promise<ResultatBlocPositionnement> {
  // ─── Étape 1 : appels parallèles — Maps et Instagram sont indépendants ────
  const [google, instagram] = await Promise.all([
    appelRoute<ResultatMaps>('/api/blocs/positionnement/maps', { destination }),
    appelRoute<ResultatInstagram>('/api/blocs/positionnement/instagram', { hashtag }),
  ])

  // ─── Étape 2 : analyse OpenAI — nourrie par les résultats des 2 modules ──
  const positionnement = await appelRoute<AnalysePositionnement | AnalysePositionnementErreur>(
    '/api/blocs/positionnement/openai',
    { destination, google, instagram }
  )

  // ─── Calcul du coût total du bloc ─────────────────────────────────────────
  const coutTotal =
    (google.cout?.cout_total ?? 0) +
    (instagram.cout?.cout_total ?? 0) +
    (positionnement.cout?.cout_total ?? 0)

  return {
    google,
    instagram,
    positionnement,
    cout_total_bloc: Math.round(coutTotal * 10000) / 10000,
  }
}
