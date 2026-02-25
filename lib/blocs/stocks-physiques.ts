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
  LigneDetail,
  SyntheseStocksPhysiques,
} from '@/types/stocks-physiques'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Seuil de déduplication : score >= 2 → doublon confirmé (abaissé depuis 3 pour réduire faux négatifs)
const SEUIL_DOUBLON = 2

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

// Mots courants à ignorer dans la comparaison (articles, prépositions, formes juridiques, générique secteur)
const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'de', 'du', 'des', 'et', 'en', 'au', 'aux',
  'un', 'une', 'sur', 'sous', 'par', 'pour',
  'hotel', 'camping', 'gite', 'residence', 'auberge', 'chalet', 'villa',
  'maison', 'chez', 'ste', 'saint', 'sainte',
])

function motsSignificatifs(nom: string): string[] {
  return normaliserNom(nom)
    .split(' ')
    .filter(m => m.length > 2 && !MOTS_VIDES.has(m))
}

function intersectionMots(a: string[], b: string[]): number {
  const setB = new Set(b)
  return a.filter(m => setB.has(m)).length
}

// ─── Score de similarité DT ↔ SIRENE ─────────────────────────────────────────

function scoreSimilarite(dt: EtablissementDT, sir: EtablissementSIRENESimplifie): number {
  let score = 0

  const nomDT = normaliserNom(dt.nom)
  const nomSIR = normaliserNom(sir.nom)

  if (nomDT === nomSIR) {
    score += 3
  } else if (nomDT.length > 3 && nomSIR.length > 3 && (nomDT.includes(nomSIR) || nomSIR.includes(nomDT))) {
    score += 2
  } else if (levenshtein(nomDT, nomSIR) <= 3) {
    score += 1
  }

  // Pivot mots significatifs communs — signal fort si ≥ 2 mots communs
  const motsA = motsSignificatifs(nomDT)
  const motsB = motsSignificatifs(nomSIR)
  const intersection = intersectionMots(motsA, motsB)
  if (intersection >= 2) {
    score += 2
  } else if (intersection === 1 && motsA.length <= 2) {
    // Nom court avec 1 seul mot significatif — signal faible mais utile
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

// ─── Comptage SIRENE par sous-catégorie NAF ───────────────────────────────────

// Mapping NAF → sous-catégorie hébergement (avec et sans point)
const NAF_SOUS_CAT_HEBERGEMENT: Record<string, string> = {
  '55.10Z': 'hotels',            '5510Z': 'hotels',
  '55.20Z': 'meubles_locations', '5520Z': 'meubles_locations',
  '55.30Z': 'campings',          '5530Z': 'campings',
  '55.90Z': 'autres',            '5590Z': 'autres',
}

// Mapping NAF → sous-catégorie activités
const NAF_SOUS_CAT_ACTIVITES: Record<string, string> = {
  '93.11Z': 'sports_loisirs', '9311Z': 'sports_loisirs',
  '93.12Z': 'sports_loisirs', '9312Z': 'sports_loisirs',
  '93.13Z': 'sports_loisirs', '9313Z': 'sports_loisirs',
  '93.19Z': 'sports_loisirs', '9319Z': 'sports_loisirs',
  '93.21Z': 'experiences',    '9321Z': 'experiences',
  '93.29Z': 'experiences',    '9329Z': 'experiences',
  '79.90Z': 'agences_activites', '7990Z': 'agences_activites',
}

// Mapping NAF → sous-catégorie culture
const NAF_SOUS_CAT_CULTURE: Record<string, string> = {
  '90.01Z': 'spectacle_vivant', '9001Z': 'spectacle_vivant',
  '90.02Z': 'spectacle_vivant', '9002Z': 'spectacle_vivant',
  '90.03A': 'spectacle_vivant', '9003A': 'spectacle_vivant',
  '91.01Z': 'musees_galeries',  '9101Z': 'musees_galeries',
  '91.02Z': 'musees_galeries',  '9102Z': 'musees_galeries',
  '91.03Z': 'patrimoine',       '9103Z': 'patrimoine',
  '91.04Z': 'nature',           '9104Z': 'nature',
}

// Mapping NAF → sous-catégorie services
const NAF_SOUS_CAT_SERVICES: Record<string, string> = {
  '79.11Z': 'agences_voyage', '7911Z': 'agences_voyage',
  '79.12Z': 'agences_voyage', '7912Z': 'agences_voyage',
  '79.90Z': 'agences_voyage', '7990Z': 'agences_voyage',
}

function compterParNAF(etabs: EtablissementSIRENESimplifie[], mapping: Record<string, string>): Record<string, number> {
  const compteurs: Record<string, number> = {}
  for (const etab of etabs) {
    const souscat = mapping[etab.naf]
    if (souscat) {
      compteurs[souscat] = (compteurs[souscat] ?? 0) + 1
    }
  }
  return compteurs
}

// ─── Helpers calcul ───────────────────────────────────────────────────────────

function pct(volume: number, total: number): number {
  if (total === 0) return 0
  return Math.round((volume / total) * 1000) / 10
}

function ligne(volume: number, total: number): LigneDetail {
  return { volume, pct: pct(volume, total) }
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

  // Sous-catégories DT
  const dtH = dt?.hebergements ?? { total: 0, hotels: 0, collectifs: 0, locations: 0, autres: 0 }
  const dtA = dt?.activites ?? { total: 0, sports_loisirs: 0, visites_tours: 0, experiences: 0 }
  const dtC = dt?.culture ?? { total: 0, patrimoine: 0, religieux: 0, musees_galeries: 0, spectacle_vivant: 0, nature: 0 }
  const dtS = dt?.services ?? { total: 0, offices_tourisme: 0, agences: 0, location_materiel: 0, transport: 0 }

  // Sous-catégories SIRENE (comptage par NAF)
  const sirH = compterParNAF(sirene?.hebergements.etablissements ?? [], NAF_SOUS_CAT_HEBERGEMENT)
  const sirA = compterParNAF(sirene?.activites.etablissements ?? [], NAF_SOUS_CAT_ACTIVITES)
  const sirC = compterParNAF(sirene?.culture.etablissements ?? [], NAF_SOUS_CAT_CULTURE)
  const sirS = compterParNAF(sirene?.services.etablissements ?? [], NAF_SOUS_CAT_SERVICES)

  // Volumes combinés hébergements (DT + SIRENE, somme sans dédup fine par sous-cat)
  const hH = dtH.hotels + (sirH.hotels ?? 0)
  const hCampings = sirH.campings ?? 0
  const hLocations = dtH.locations + (sirH.meubles_locations ?? 0)
  const hCollectifs = dtH.collectifs
  const hAutres = dtH.autres + (sirH.autres ?? 0)

  // Volumes combinés activités
  const aSports = dtA.sports_loisirs + (sirA.sports_loisirs ?? 0)
  const aVisites = dtA.visites_tours
  const aExp = dtA.experiences + (sirA.experiences ?? 0)
  const aAgences = sirA.agences_activites ?? 0

  // Volumes combinés culture
  const cPatrimoine = dtC.patrimoine + (sirC.patrimoine ?? 0)
  const cReligieux = dtC.religieux
  const cMusees = dtC.musees_galeries + (sirC.musees_galeries ?? 0)
  const cSpectacle = dtC.spectacle_vivant + (sirC.spectacle_vivant ?? 0)
  const cNature = dtC.nature + (sirC.nature ?? 0)

  // Volumes combinés services
  const sOT = dtS.offices_tourisme
  const sAgences = dtS.agences + (sirS.agences_voyage ?? 0)
  const sLocation = dtS.location_materiel
  const sTransport = dtS.transport

  // Couverture DT par catégorie = doublons / total SIRENE de la catégorie
  const couvH = (sirene?.hebergements.total ?? 0) > 0
    ? Math.round((calcHebergements.deux_sources / sirene!.hebergements.total) * 100)
    : (dt ? 100 : 0)
  const couvA = (sirene?.activites.total ?? 0) > 0
    ? Math.round((calcActivites.deux_sources / sirene!.activites.total) * 100)
    : (dt ? 100 : 0)
  const couvC = (sirene?.culture.total ?? 0) > 0
    ? Math.round((calcCulture.deux_sources / sirene!.culture.total) * 100)
    : (dt ? 100 : 0)
  const couvS = (sirene?.services.total ?? 0) > 0
    ? Math.round((calcServices.deux_sources / sirene!.services.total) * 100)
    : (dt ? 100 : 0)
  const totalSirene = sirene?.total_global ?? 0
  const totalDoublons = calcHebergements.deux_sources + calcActivites.deux_sources + calcCulture.deux_sources + calcServices.deux_sources
  const couvGlobal = totalSirene > 0
    ? Math.round((totalDoublons / totalSirene) * 100)
    : (dt ? 100 : 0)

  // Ratio particuliers hébergement = meublés NAF 55.20Z / total SIRENE hébergements
  const sirHTotal = sirene?.hebergements.total ?? 0
  const ratio_particuliers_hebergement = sirHTotal > 0
    ? Math.round(((sirH.meubles_locations ?? 0) / sirHTotal) * 1000) / 10
    : 0

  const total = calcHebergements.total + calcActivites.total + calcCulture.total + calcServices.total

  return {
    hebergements: {
      total_unique: calcHebergements.total,
      dont_data_tourisme: calcHebergements.dt_only,
      dont_sirene: calcHebergements.sir_only,
      dont_deux_sources: calcHebergements.deux_sources,
      detail: {
        hotels:            ligne(hH,        calcHebergements.total),
        campings:          ligne(hCampings,  calcHebergements.total),
        meubles_locations: ligne(hLocations, calcHebergements.total),
        collectifs:        ligne(hCollectifs,calcHebergements.total),
        autres:            ligne(hAutres,    calcHebergements.total),
      },
    },
    activites: {
      total_unique: calcActivites.total,
      dont_data_tourisme: calcActivites.dt_only,
      dont_sirene: calcActivites.sir_only,
      dont_deux_sources: calcActivites.deux_sources,
      detail: {
        sports_loisirs:    ligne(aSports,  calcActivites.total),
        visites_tours:     ligne(aVisites, calcActivites.total),
        experiences:       ligne(aExp,     calcActivites.total),
        agences_activites: ligne(aAgences, calcActivites.total),
      },
    },
    culture: {
      total_unique: calcCulture.total,
      dont_data_tourisme: calcCulture.dt_only,
      dont_sirene: calcCulture.sir_only,
      dont_deux_sources: calcCulture.deux_sources,
      detail: {
        patrimoine:       ligne(cPatrimoine, calcCulture.total),
        religieux:        ligne(cReligieux,  calcCulture.total),
        musees_galeries:  ligne(cMusees,     calcCulture.total),
        spectacle_vivant: ligne(cSpectacle,  calcCulture.total),
        nature:           ligne(cNature,     calcCulture.total),
      },
    },
    services: {
      total_unique: calcServices.total,
      dont_data_tourisme: calcServices.dt_only,
      dont_sirene: calcServices.sir_only,
      dont_deux_sources: calcServices.deux_sources,
      detail: {
        offices_tourisme:  ligne(sOT,       calcServices.total),
        agences_voyage:    ligne(sAgences,  calcServices.total),
        location_materiel: ligne(sLocation, calcServices.total),
        transport:         ligne(sTransport,calcServices.total),
      },
    },
    total_stock_physique: total,
    couverture: {
      hebergements: couvH,
      activites:    couvA,
      culture:      couvC,
      services:     couvS,
      global:       couvGlobal,
    },
    ratio_particuliers_hebergement,
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
