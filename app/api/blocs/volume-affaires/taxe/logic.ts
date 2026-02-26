// Logique métier — taxe de séjour via data.economie.gouv.fr
// Interroge les balances comptables (comptes 731721 + 731722) pour communes et EPCI
// Extrait de route.ts pour permettre l'import direct depuis l'orchestrateur (évite les appels auto-référentiels)

import axios from 'axios'

// Datasets disponibles (du plus récent au plus ancien)
const DATASET_COMMUNES = {
  2024: 'balances-comptables-des-communes-en-2024',
  2023: 'balances-comptables-des-communes-en-2023',
}

const DATASET_EPCI =
  'balances-comptables-des-groupements-a-fiscalite-propre-depuis-2010'

const BASE_URL = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets'

/**
 * Interroge un dataset communes pour un SIREN et une année donnée.
 * Retourne { lignes, annee } ou null si aucune donnée.
 */
async function fetchCommune(
  siren: string,
  annee: number
): Promise<{ lignes: Record<string, string>[]; annee: number } | null> {
  const dataset = DATASET_COMMUNES[annee as keyof typeof DATASET_COMMUNES]
  if (!dataset) return null

  const reponse = await axios.get(`${BASE_URL}/${dataset}/records`, {
    params: {
      where: `siren='${siren}' AND (compte='731721' OR compte='731722')`,
      select: 'siren,lbudg,compte,obnetcre,nomen',
      limit: 10,
    },
    timeout: 30000,
  })

  const total = reponse.data?.total_count ?? 0
  if (total === 0) return null

  return { lignes: reponse.data.results ?? [], annee }
}

/**
 * Interroge le dataset EPCI pour un SIREN et une année donnée.
 * Retourne { lignes, annee } ou null si aucune donnée.
 */
async function fetchEpci(
  siren: string,
  annee: number
): Promise<{ lignes: Record<string, string>[]; annee: number } | null> {
  const reponse = await axios.get(`${BASE_URL}/${DATASET_EPCI}/records`, {
    params: {
      where: `siren='${siren}' AND exer='${annee}' AND (compte='731721' OR compte='731722')`,
      select: 'siren,lbudg,compte,obnetcre,nomen,exer',
      limit: 10,
    },
    timeout: 30000,
  })

  const total = reponse.data?.total_count ?? 0
  if (total === 0) return null

  return { lignes: reponse.data.results ?? [], annee }
}

/**
 * Récupère le montant de taxe de séjour pour une commune ou un EPCI.
 * Tente N-1 (2024) en premier, puis fallback sur 2023.
 */
export async function executerTaxe({
  siren,
  type_collecteur,
  annee,
}: {
  siren: string
  type_collecteur: string
  annee?: number
}): Promise<{
  siren: string
  lbudg: string
  montant_taxe_euros: number
  annee_donnees: number
  taxe_non_instituee: boolean
  dataset_source: string
}> {
  if (!siren || !type_collecteur) {
    throw new Error('siren et type_collecteur requis')
  }

  let resultat: { lignes: Record<string, string>[]; annee: number } | null = null
  let dataset_source = ''

  if (type_collecteur === 'commune') {
    // Tentative sur N-1 (2024) puis fallback sur 2023
    const anneeDepart = annee ?? 2024
    resultat = await fetchCommune(siren, anneeDepart)

    if (!resultat && anneeDepart === 2024) {
      resultat = await fetchCommune(siren, 2023)
    }

    dataset_source = resultat
      ? DATASET_COMMUNES[resultat.annee as keyof typeof DATASET_COMMUNES]
      : DATASET_COMMUNES[2024]
  } else {
    // EPCI — tentative sur 2024 puis fallback sur 2023
    const anneeDepart = annee ?? 2024
    resultat = await fetchEpci(siren, anneeDepart)

    if (!resultat && anneeDepart === 2024) {
      resultat = await fetchEpci(siren, 2023)
    }

    dataset_source = DATASET_EPCI
  }

  // Agrégation des obnetcre — plusieurs lignes (731721 + 731722)
  // obnetcre peut être null → traité comme 0
  const montant_taxe_euros = (resultat?.lignes ?? []).reduce((somme, ligne) => {
    const valeur = parseFloat(ligne['obnetcre'] ?? '0') || 0
    return somme + valeur
  }, 0)

  const annee_donnees = resultat?.annee ?? (annee ?? 2024)
  const lbudg = resultat?.lignes?.[0]?.['lbudg'] ?? ''

  return {
    siren,
    lbudg,
    montant_taxe_euros: Math.round(montant_taxe_euros * 100) / 100,
    annee_donnees,
    taxe_non_instituee: montant_taxe_euros === 0,
    dataset_source,
  }
}
