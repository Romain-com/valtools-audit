// Orchestrateur — Bloc 5 : Stocks physiques (DATA Tourisme + SIRENE)
// Responsabilité : collecter les deux sources, dédupliquer, fusionner, générer la synthèse
// Flux : DATA Tourisme ‖ SIRENE → déduplication → synthèse OpenAI → tracking coûts

import { enregistrerCoutsBloc } from '@/lib/tracking-couts'
import type {
  ParamsBloc5,
  ResultatBloc5,
  RetourStocksDATATourisme,
  RetourStocksSIRENE,
  EtablissementDT,
  EtablissementSIRENESimplifie,
  StocksPhysiquesFinaux,
  StocksParCategorie,
  SyntheseStocksPhysiques,
} from '@/types/stocks-physiques'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Seuil de déduplication : score >= 3 → doublon confirmé
const SEUIL_DOUBLON = 3

// ─── Helpers d'appel HTTP ─────────────────────────────────────────────────────

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

// ─── Normalisation pour la déduplication ─────────────────────────────────────

function normaliserNom(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(sarl|sas|sa|eurl|sci|sca|snc|scp|earl|gaec|sasu|ei|auto.entrepreneur)\b/gi, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normaliserAdresse(adresse: string | null): string | null {
  if (!adresse) return null
  return adresse
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[m][n]
}

// ─── Score de similarité DT ↔ SIRENE ─────────────────────────────────────────

function scoreSimilarite(dt: EtablissementDT, sir: EtablissementSIRENESimplifie): number {
  let score = 0

  const nomDT = normaliserNom(dt.nom)
  const nomSIR = normaliserNom(sir.nom)

  if (nomDT === nomSIR) {
    score += 3
  } else if (nomDT.includes(nomSIR) || nomSIR.includes(nomDT)) {
    score += 2
  } else if (levenshtein(nomDT, nomSIR) <= 3) {
    score += 1
  }

  // Code postal identique → bonus adresse
  if (dt.code_postal && sir.code_postal && dt.code_postal === sir.code_postal) {
    score += 1
    const adrDT = normaliserAdresse(dt.adresse)
    const adrSIR = normaliserAdresse(sir.adresse)
    if (adrDT && adrSIR) {
      const motsDT = adrDT.split(' ')
      const motsSIR = adrSIR.split(' ')
      if (motsDT[0] && adrSIR.includes(motsDT[0])) score += 1
      else if (motsSIR[0] && adrDT.includes(motsSIR[0])) score += 1
    }
  }

  return score
}

// ─── Déduplication et fusion par catégorie ────────────────────────────────────

interface ComptageCategorie {
  dt_only: number
  sir_only: number
  deux_sources: number
  total: number
}

function deduplicerCategorie(
  dtEtabs: EtablissementDT[],
  sirEtabs: EtablissementSIRENESimplifie[]
): ComptageCategorie {
  if (dtEtabs.length === 0 && sirEtabs.length === 0) {
    return { dt_only: 0, sir_only: 0, deux_sources: 0, total: 0 }
  }

  // Marquer les établissements SIRENE qui ont un doublon dans DT
  const sireneMatches = new Set<number>()
  const dtMatches = new Set<number>()

  for (let i = 0; i < dtEtabs.length; i++) {
    for (let j = 0; j < sirEtabs.length; j++) {
      if (sireneMatches.has(j)) continue
      if (scoreSimilarite(dtEtabs[i], sirEtabs[j]) >= SEUIL_DOUBLON) {
        dtMatches.add(i)
        sireneMatches.add(j)
        break
      }
    }
  }

  const deux_sources = sireneMatches.size
  const dt_only = dtEtabs.length - dtMatches.size
  const sir_only = sirEtabs.length - sireneMatches.size
  const total = dt_only + sir_only + deux_sources

  return { dt_only, sir_only, deux_sources, total }
}

// ─── Fusion complète des deux sources ────────────────────────────────────────

function fusionnerStocks(
  dt: RetourStocksDATATourisme | null,
  sirene: RetourStocksSIRENE | null
): StocksPhysiquesFinaux {
  // Préparer les listes par catégorie pour DT (regrouper par catégorie)
  const dtParCat: Record<string, EtablissementDT[]> = {
    hebergements: [],
    activites: [],
    culture: [],
    services: [],
  }

  if (dt) {
    for (const etab of dt.etablissements_bruts) {
      const cat = etab.categorie as keyof typeof dtParCat
      if (dtParCat[cat]) dtParCat[cat].push(etab as EtablissementDT)
    }
  }

  // Déduplication par catégorie
  const calcHebergements = deduplicerCategorie(
    dtParCat.hebergements,
    sirene?.hebergements.etablissements ?? []
  )
  const calcActivites = deduplicerCategorie(
    dtParCat.activites,
    sirene?.activites.etablissements ?? []
  )
  const calcCulture = deduplicerCategorie(
    dtParCat.culture,
    sirene?.culture.etablissements ?? []
  )
  const calcServices = deduplicerCategorie(
    dtParCat.services,
    sirene?.services.etablissements ?? []
  )

  // Compteurs DT pour les sous-catégories
  const dtH = dt?.hebergements ?? { total: 0, hotels: 0, collectifs: 0, locations: 0, autres: 0 }
  const dtA = dt?.activites ?? { total: 0, sports_loisirs: 0, visites_tours: 0, experiences: 0 }
  const dtS = dt?.services ?? { total: 0, offices_tourisme: 0, agences: 0, location_materiel: 0, transport: 0 }

  const total = calcHebergements.total + calcActivites.total + calcCulture.total + calcServices.total

  // Taux de couverture DATA Tourisme = % des établissements SIRENE trouvés dans DT
  const totalSirene = sirene?.total_global ?? 0
  const totalDoublons = calcHebergements.deux_sources + calcActivites.deux_sources + calcCulture.deux_sources + calcServices.deux_sources
  const taux_couverture_dt = totalSirene > 0
    ? Math.round((totalDoublons / totalSirene) * 100)
    : dt ? 100 : 0

  return {
    hebergements: {
      total_unique: calcHebergements.total,
      dont_data_tourisme: calcHebergements.dt_only,
      dont_sirene: calcHebergements.sir_only,
      dont_deux_sources: calcHebergements.deux_sources,
      hotels: dtH.hotels,
      collectifs: dtH.collectifs,
      locations: dtH.locations,
      autres: dtH.autres,
    },
    activites: {
      total_unique: calcActivites.total,
      dont_data_tourisme: calcActivites.dt_only,
      dont_sirene: calcActivites.sir_only,
      dont_deux_sources: calcActivites.deux_sources,
      sports_loisirs: dtA.sports_loisirs,
      visites_tours: dtA.visites_tours,
      experiences: dtA.experiences,
    },
    culture: {
      total_unique: calcCulture.total,
      dont_data_tourisme: calcCulture.dt_only,
      dont_sirene: calcCulture.sir_only,
      dont_deux_sources: calcCulture.deux_sources,
    },
    services: {
      total_unique: calcServices.total,
      dont_data_tourisme: calcServices.dt_only,
      dont_sirene: calcServices.sir_only,
      dont_deux_sources: calcServices.deux_sources,
      offices_tourisme: dtS.offices_tourisme,
      agences: dtS.agences,
      location_materiel: dtS.location_materiel,
      transport: dtS.transport,
    },
    total_stock_physique: total,
    taux_couverture_dt,
    sources_disponibles: {
      data_tourisme: !!dt,
      sirene: !!sirene,
    },
  }
}

// ─── Point d'entrée du Bloc 5 ─────────────────────────────────────────────────

/**
 * Lance le Bloc 5 — Stocks physiques.
 *
 * @param destination  - Nom de la destination (ex: "Annecy")
 * @param code_insee   - Code INSEE de la commune (ex: "74010")
 * @param audit_id     - UUID de l'audit Supabase
 */
export async function lancerBlocStocksPhysiques(
  { destination, code_insee, audit_id }: ParamsBloc5
): Promise<ResultatBloc5> {
  const erreurs_partielles: string[] = []
  const sources_utilisees: string[] = []

  // ─── Étape 1 : collecte parallèle des deux sources ──────────────────────────
  const [dt_settled, sirene_settled] = await Promise.allSettled([
    appelRoute<RetourStocksDATATourisme>(
      '/api/blocs/stocks-physiques/datatourisme',
      { code_insee }
    ),
    appelRoute<RetourStocksSIRENE>(
      '/api/blocs/stocks-physiques/sirene',
      { code_insee }
    ),
  ])

  const dt_result = dt_settled.status === 'fulfilled' ? dt_settled.value : null
  const sirene_result = sirene_settled.status === 'fulfilled' ? sirene_settled.value : null

  if (dt_settled.status === 'rejected') {
    const msg = `DATA Tourisme indisponible : ${dt_settled.reason}`
    console.warn('[Bloc 5]', msg)
    erreurs_partielles.push(msg)
  } else {
    sources_utilisees.push('data_tourisme')
  }

  if (sirene_settled.status === 'rejected') {
    const msg = `SIRENE indisponible : ${sirene_settled.reason}`
    console.warn('[Bloc 5]', msg)
    erreurs_partielles.push(msg)
  } else {
    sources_utilisees.push('sirene')
  }

  // Cas limite : aucune source disponible
  if (!dt_result && !sirene_result) {
    throw new Error('[Bloc 5] Aucune source de données disponible pour les stocks physiques')
  }

  // ─── Étape 2 : déduplication et fusion ──────────────────────────────────────
  const stocks = fusionnerStocks(dt_result, sirene_result)

  // ─── Étape 3 : synthèse OpenAI ───────────────────────────────────────────────
  let synthese: SyntheseStocksPhysiques | null = null
  try {
    synthese = await appelRoute<SyntheseStocksPhysiques>(
      '/api/blocs/stocks-physiques/synthese',
      { destination, stocks }
    )
  } catch (err) {
    const msg = `Synthèse OpenAI échouée : ${err}`
    console.warn('[Bloc 5]', msg)
    erreurs_partielles.push(msg)
  }

  // ─── Étape 4 : tracking des coûts (fire & forget) ──────────────────────────
  // DATA Tourisme (local) et SIRENE (open data) sont gratuits — seul OpenAI est payant
  enregistrerCoutsBloc(audit_id, 'stocks_physiques', {
    openai: synthese ? { nb_appels: 1, cout_unitaire: 0.001, cout_total: 0.001 } : { nb_appels: 0, cout_unitaire: 0, cout_total: 0 },
    total_bloc: synthese ? 0.001 : 0,
  })

  return {
    stocks,
    synthese,
    meta: {
      cout_total_euros: synthese ? 0.001 : 0,
      sources_utilisees,
      erreurs_partielles,
    },
  }
}
