// Route Handler — /api/blocs/stocks-physiques/sirene
// Interroge l'API "Recherche Entreprises" (recherche-entreprises.api.gouv.fr)
// Source libre, sans authentification, rate limit 25 req/s
//
// ⚠️ Migration depuis l'ancien SIRENE OAuth2 (api.insee.fr/token — déprécié)
//    Le nouveau portail INSEE (portail-api.insee.fr) utilise API_KEY plan
//    Les credentials SIRENE_CLIENT_ID/SECRET sont pour l'ancienne API — non valides
//    → Remplacement par l'API Recherche Entreprises (api.gouv.fr) sans auth
//
// Architecture :
//   - 1 requête paginée par code NAF (4 catégories × N codes)
//   - Pour chaque entreprise, matching_etablissements = établissements dans la commune cible
//   - Comptage des établissements réels (pas des entreprises)

import { NextRequest, NextResponse } from 'next/server'
import type { RetourStocksSIRENE, EtablissementSIRENESimplifie } from '@/types/stocks-physiques'

const RECHERCHE_URL = 'https://recherche-entreprises.api.gouv.fr/search'

// ─── Codes NAF par catégorie touristique ──────────────────────────────────────
// Format avec point (55.10Z) requis par l'API recherche-entreprises

const NAF_PAR_CATEGORIE: Record<string, string[]> = {
  hebergements: ['55.10Z', '55.20Z', '55.30Z', '55.90Z'],
  activites: ['93.11Z', '93.12Z', '93.13Z', '93.19Z', '93.21Z', '93.29Z', '79.90Z'],
  culture: ['90.01Z', '90.02Z', '90.03A', '91.01Z', '91.02Z', '91.03Z', '91.04Z'],
  services: ['79.11Z', '79.12Z', '79.90Z'],
}

// ─── Interface réponse API Recherche Entreprises ───────────────────────────────

interface EtablissementMatch {
  siret: string
  commune: string
  adresse: string | null
  activite_principale: string
  etat_administratif: string
  nom_etablissement?: string
  code_postal?: string | null
}

interface ResultatEntreprise {
  siren: string
  nom_complet: string
  matching_etablissements: EtablissementMatch[]
}

interface ReponsePaginee {
  total_results: number
  total_pages: number
  page: number
  results: ResultatEntreprise[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Requête paginée pour un code NAF ─────────────────────────────────────────

async function fetchEtablissementsNAF(
  code_insee: string,
  codeNaf: string
): Promise<EtablissementSIRENESimplifie[]> {
  const etablissements: EtablissementSIRENESimplifie[] = []
  let page = 1

  while (true) {
    const params = new URLSearchParams({
      code_commune: code_insee,
      activite_principale: codeNaf,
      etat_administratif: 'A',        // établissements actifs uniquement
      per_page: '25',
      page: String(page),
      limite_matching_etablissements: '25',  // établissements dans la commune
    })

    // Retry sur 429 (rate limit) — max 3 tentatives avec backoff
    let reponse: Response
    let tentatives = 0
    while (true) {
      reponse = await fetch(`${RECHERCHE_URL}?${params}`, {
        headers: { Accept: 'application/json' },
      })
      if (reponse.status === 429 && tentatives < 3) {
        tentatives++
        await sleep(1500 * tentatives)
      } else {
        break
      }
    }

    if (!reponse.ok) {
      // 400 = code NAF invalide ou autre erreur non critique — on continue
      if (reponse.status === 400) break
      throw new Error(`Recherche entreprises ${codeNaf} — Erreur ${reponse.status}`)
    }

    const data = (await reponse.json()) as ReponsePaginee

    for (const entreprise of data.results ?? []) {
      for (const etab of entreprise.matching_etablissements ?? []) {
        // Ne garder que les établissements dans la commune cible et actifs
        if (etab.commune !== code_insee) continue
        if (etab.etat_administratif !== 'A') continue

        etablissements.push({
          siret: etab.siret,
          nom: entreprise.nom_complet,
          naf: etab.activite_principale,
          adresse: etab.adresse ?? null,
          code_postal: etab.code_postal ?? null,
        })
      }
    }

    // Arrêter si dernière page
    if (page >= (data.total_pages ?? 1) || data.results.length < 25) break
    page++
  }

  return etablissements
}

// ─── Dédupliquer les établissements par SIRET ─────────────────────────────────
// Certains codes NAF se chevauchent (ex: 79.90Z dans activites ET services)

function deduplicerParSiret(
  etablissements: EtablissementSIRENESimplifie[]
): EtablissementSIRENESimplifie[] {
  const vus = new Set<string>()
  return etablissements.filter(e => {
    if (vus.has(e.siret)) return false
    vus.add(e.siret)
    return true
  })
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { code_insee } = await req.json()

    if (!code_insee) {
      return NextResponse.json({ error: 'code_insee requis' }, { status: 400 })
    }

    // Récupérer tous les codes NAF en parallèle par catégorie
    // ⚠️ Séquentiel par code NAF au sein d'une catégorie pour respecter le rate limit
    //    Parallèle entre catégories (4 catégories simultanées)

    async function fetchCategorie(codesNaf: string[]): Promise<EtablissementSIRENESimplifie[]> {
      const tous: EtablissementSIRENESimplifie[] = []
      for (const naf of codesNaf) {
        const etabs = await fetchEtablissementsNAF(code_insee, naf)
        tous.push(...etabs)
        await sleep(300)  // délai inter-requêtes NAF pour respecter le rate limit
      }
      return deduplicerParSiret(tous)
    }

    const [hebergements, activites, culture, services] = await Promise.all([
      fetchCategorie(NAF_PAR_CATEGORIE.hebergements),
      fetchCategorie(NAF_PAR_CATEGORIE.activites),
      fetchCategorie(NAF_PAR_CATEGORIE.culture),
      fetchCategorie(NAF_PAR_CATEGORIE.services),
    ])

    const resultat: RetourStocksSIRENE = {
      code_insee,
      hebergements: { total: hebergements.length, etablissements: hebergements },
      activites: { total: activites.length, etablissements: activites },
      culture: { total: culture.length, etablissements: culture },
      services: { total: services.length, etablissements: services },
      total_global: hebergements.length + activites.length + culture.length + services.length,
    }

    return NextResponse.json(resultat)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
