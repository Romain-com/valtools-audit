// Route POST /api/territoire/analyser
// Pour chaque commune validée : récupère les stocks DATA Tourisme (via microservice)
// et la taxe de séjour (via la logique existante executerTaxe).
// Supporte jusqu'à 50 communes en parallèle.

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { executerTaxe } from '@/app/api/blocs/volume-affaires/taxe/logic'

const MELODI_BASE = 'https://api.insee.fr/melodi'

// ─── INSEE DS_TOUR_CAP — capacité hébergements touristiques (commune) ─────────
// Codes ACTIVITY : I551=hôtels, I552=campings, I553=autres hébergements collectifs
// GEO format : 2025-COM-{code_insee} (millésime géographique 2025, données 2026)
// TOUR_MEASURE : UNIT_LOC=établissements, PLACE=chambres/emplacements, BEDPLACE=lits

interface CapaciteINSEE {
  hotels: { nb_etab: number; nb_chambres: number }
  campings: { nb_etab: number; nb_emplacements: number }
  autres_heb: { nb_etab: number }
  total_etab: number
  annee: number
  source: 'melodi_cap'
}

async function fetchCapaciteINSEE(code_insee: string): Promise<CapaciteINSEE | null> {
  try {
    const reponse = await axios.get(`${MELODI_BASE}/data/DS_TOUR_CAP`, {
      params: {
        GEO: `2025-COM-${code_insee}`,
        UNIT_LOC_RANKING: '_T',
        L_STAY: '_T',
      },
      timeout: 15000,
    })

    const obs: Record<string, unknown>[] = reponse.data?.observations ?? []
    if (obs.length === 0) return null

    const getValue = (activity: string, measure: string): number => {
      const o = obs.find(
        (o) =>
          (o.dimensions as Record<string, string>)?.ACTIVITY === activity &&
          (o.dimensions as Record<string, string>)?.TOUR_MEASURE === measure
      )
      return Math.round((o?.measures as Record<string, { value: number }>)?.OBS_VALUE_NIVEAU?.value ?? 0)
    }

    const hotels_etab  = getValue('I551', 'UNIT_LOC')
    const hotels_ch    = getValue('I551', 'PLACE')
    const campings_etab = getValue('I552', 'UNIT_LOC')
    const campings_empl = getValue('I552', 'PLACE')
    const autres_etab  = getValue('I553', 'UNIT_LOC')

    return {
      hotels:          { nb_etab: hotels_etab,   nb_chambres: hotels_ch },
      campings:        { nb_etab: campings_etab,  nb_emplacements: campings_empl },
      autres_heb:      { nb_etab: autres_etab },
      total_etab:      hotels_etab + campings_etab + autres_etab,
      annee:           2026,
      source:          'melodi_cap',
    }
  } catch {
    return null
  }
}

// ─── INSEE DS_TOUR_FREQ — fréquentation touristique (département) ─────────────
// GEO format : 2023-DEP-{code_dept} (millésime géographique 2023)
// TOUR_MEASURE : NUI=nuitées, ARR=arrivées
// UNIT_MULT=3 : valeurs en milliers → multiplier par 1 000 pour obtenir le réel
// Codes ACTIVITY : I551=hôtels, I553=autres hébergements collectifs

interface FrequentationINSEE {
  nuitees_total: number
  nuitees_hotels: number
  nuitees_autres: number
  annee: number
  code_departement: string
  source: 'melodi_freq'
}

async function fetchFrequentationINSEE(code_departement: string): Promise<FrequentationINSEE | null> {
  try {
    const reponse = await axios.get(`${MELODI_BASE}/data/DS_TOUR_FREQ`, {
      params: {
        GEO: `2023-DEP-${code_departement}`,
        FREQ: 'A',
        TOUR_MEASURE: 'NUI',
        TOUR_RESID: '_T',
        HOTEL_STA: '_T',
        UNIT_LOC_RANKING: '_T',
      },
      timeout: 15000,
    })

    const obs: Record<string, unknown>[] = reponse.data?.observations ?? []
    if (obs.length === 0) return null

    // Trouver l'année la plus récente dans les données
    const periodes = obs
      .map((o) => (o.dimensions as Record<string, string>)?.TIME_PERIOD)
      .filter(Boolean)
      .sort()
    const dernierePeriode = periodes[periodes.length - 1]
    const annee = parseInt(dernierePeriode ?? '0')

    const obsAnnee = obs.filter(
      (o) => (o.dimensions as Record<string, string>)?.TIME_PERIOD === dernierePeriode
    )

    const getNuitees = (activity: string): number => {
      const o = obsAnnee.find(
        (o) => (o.dimensions as Record<string, string>)?.ACTIVITY === activity
      )
      // UNIT_MULT=3 : les valeurs sont en milliers
      const raw = (o?.measures as Record<string, { value: number }>)?.OBS_VALUE_NIVEAU?.value ?? 0
      return Math.round(raw * 1000)
    }

    const nuitees_hotels = getNuitees('I551')
    const nuitees_autres = getNuitees('I553')

    return {
      nuitees_total:   nuitees_hotels + nuitees_autres,
      nuitees_hotels,
      nuitees_autres,
      annee,
      code_departement,
      source: 'melodi_freq',
    }
  } catch {
    return null
  }
}

/**
 * Récupère le nombre de résidences secondaires d'une commune via Mélodi INSEE RP 2022.
 * API open data — pas de clé requise.
 * Réutilise la même logique que app/api/blocs/volume-affaires/melodi/logic.ts.
 */
async function fetchResidencesSecondaires(code_insee: string): Promise<number | null> {
  try {
    const reponse = await axios.get(`${MELODI_BASE}/data/DS_RP_LOGEMENT_PRINC`, {
      params: { GEO: `COM-${code_insee}`, OCS: 'DW_SEC_DW_OCC', TIME_PERIOD: '2022', TDW: '_T' },
      timeout: 15000,
    })
    const obs = reponse.data?.observations ?? []
    const total = obs.find(
      (o: Record<string, unknown>) => (o.dimensions as Record<string, string>)?.TDW === '_T'
    ) ?? obs[0]
    const valeur = Math.round(
      (total?.measures as Record<string, { value: number }>)?.OBS_VALUE_NIVEAU?.value ?? 0
    )
    return valeur
  } catch {
    return null
  }
}

/**
 * Récupère le total des résidences secondaires d'un EPCI via Mélodi INSEE RP 2022.
 * Même dataset que les communes, géographie EPCI-{siren_epci}.
 * Permet un prorata plus pertinent que la population permanente pour la taxe de séjour.
 */
async function fetchResidencesSecondairesEPCI(siren_epci: string): Promise<number | null> {
  try {
    const reponse = await axios.get(`${MELODI_BASE}/data/DS_RP_LOGEMENT_PRINC`, {
      params: { GEO: `EPCI-${siren_epci}`, OCS: 'DW_SEC_DW_OCC', TIME_PERIOD: '2022', TDW: '_T' },
      timeout: 15000,
    })
    const obs = reponse.data?.observations ?? []
    if (obs.length === 0) {
      console.warn(`[RS EPCI] Aucune observation pour EPCI-${siren_epci} — vérifier format GEO Mélodi`)
      return null
    }
    const total = obs.find(
      (o: Record<string, unknown>) => (o.dimensions as Record<string, string>)?.TDW === '_T'
    ) ?? obs[0]
    const valeur = Math.round(
      (total?.measures as Record<string, { value: number }>)?.OBS_VALUE_NIVEAU?.value ?? 0
    )
    console.log(`[RS EPCI] EPCI-${siren_epci} → ${valeur} résidences secondaires`)
    return valeur > 0 ? valeur : null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[RS EPCI] Échec API pour EPCI-${siren_epci} : ${msg} — fallback population`)
    return null
  }
}

const MICROSERVICE_URL = process.env.DATA_TOURISME_API_URL ?? 'http://localhost:3001'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommuneInput {
  nom: string
  siren: string
  code_insee: string
  code_postal: string
  code_departement: string
  population: number
}

interface Etablissement {
  uuid: string
  nom: string
  categorie: 'hebergements' | 'activites' | 'culture' | 'services'
  sous_categorie: string
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  lat: number | null
  lng: number | null
  capacite: number | null
}

interface ResultatTaxe {
  collecteur: 'commune' | 'epci' | 'non_institue'
  nom_collecteur: string
  siren_collecteur: string
  montant_total: number
  montant_estime_commune: number | null  // si collecteur = 'epci'
  part_epci_pct: number | null           // part de la commune dans l'EPCI (%)
  methode_part: 'residences_secondaires' | 'rs_hybride' | 'population' | null
  // 'residences_secondaires' : RS commune / RS EPCI (les deux connus)
  // 'rs_hybride'             : RS connues pour certaines communes EPCI, population pour les autres
  // 'population'             : RS EPCI inconnue → fallback population pure
  annee: number
  nuitees_estimees: number
}

interface ResultatCommune {
  commune: {
    nom: string
    code_insee: string
    code_postal: string
    code_departement: string
  }
  hebergements: Etablissement[]
  poi: Etablissement[]       // activites + culture + services
  taxe: ResultatTaxe | null
  residences_secondaires: number | null  // RP 2022 Mélodi INSEE — null si données absentes
  insee_cap: CapaciteINSEE | null        // DS_TOUR_CAP — capacité officielle par type
  freq_departement: FrequentationINSEE | null  // DS_TOUR_FREQ — nuitées annuelles du département
  erreur?: string
}

// ─── Appels microservice ──────────────────────────────────────────────────────

async function fetchStocks(code_insee: string): Promise<{ hebergements: Etablissement[]; poi: Etablissement[] }> {
  const reponse = await axios.get(`${MICROSERVICE_URL}/stocks`, {
    params: { code_insee },
    timeout: 15000,
  })

  const bruts: Etablissement[] = reponse.data.etablissements_bruts ?? []

  return {
    hebergements: bruts.filter((e) => e.categorie === 'hebergements'),
    poi: bruts.filter((e) => e.categorie !== 'hebergements'),
  }
}

interface InfosEpci {
  siren_epci: string
  nom_epci: string
  population_epci: number
}

async function fetchEpci(code_insee: string): Promise<InfosEpci | null> {
  try {
    const reponse = await axios.get(`${MICROSERVICE_URL}/epci`, {
      params: { code_insee },
      timeout: 10000,
    })
    return {
      siren_epci: reponse.data.siren_epci,
      nom_epci: reponse.data.nom_epci,
      population_epci: reponse.data.population_epci ?? 0,
    }
  } catch {
    return null
  }
}

// ─── Prorata hybride RS + population sur EPCI complet ────────────────────────

/**
 * Récupère la liste de toutes les communes d'un EPCI depuis geo.api.gouv.fr.
 * Utilisé pour calculer le prorata hybride sur la totalité de l'EPCI.
 */
async function fetchCommunesEPCI(siren_epci: string): Promise<{ code: string; population: number }[]> {
  try {
    const reponse = await axios.get(`https://geo.api.gouv.fr/epcis/${siren_epci}/communes`, {
      params: { fields: 'code,population' },
      timeout: 10000,
    })
    return (reponse.data ?? []).map((c: { code: string; population?: number }) => ({
      code: c.code,
      population: c.population ?? 0,
    }))
  } catch (err) {
    console.warn(`[ProratHybride] fetchCommunesEPCI ${siren_epci} échoué :`, err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Construit la map code_insee → RS pour toutes les communes d'un EPCI.
 * Réutilise les RS déjà récupérées pour les communes sélectionnées.
 * Fetch séquentiel avec délai pour respecter le rate limit Mélodi.
 * Plafonné à MAX_COMMUNES_INCONNUES pour éviter les timeouts.
 */
const MAX_COMMUNES_INCONNUES = 40
const DELAI_MELODI_MS = 400 // ~150 req/min — en deçà du rate limit Mélodi

async function construireMapRSEPCI(
  communes_epci: { code: string; population: number }[],
  rs_deja_connues: Map<string, number | null>,
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>(rs_deja_connues)

  const codes_inconnus = communes_epci
    .map((c) => c.code)
    .filter((code) => !map.has(code))
    .slice(0, MAX_COMMUNES_INCONNUES)

  console.log(`[ProratHybride] Fetch RS pour ${codes_inconnus.length} communes non sélectionnées (/${communes_epci.length} total EPCI)`)

  for (const code of codes_inconnus) {
    await new Promise((resolve) => setTimeout(resolve, DELAI_MELODI_MS))
    const rs = await fetchResidencesSecondaires(code)
    map.set(code, rs)
  }

  return map
}

/**
 * Calcule la part d'une commune dans le montant EPCI via l'algorithme hybride :
 *   Passe 1 — communes avec RS connue : part = RS_commune / RS_EPCI
 *   Passe 2 — communes sans RS        : part = (RS_EPCI - RS_total_connu) / RS_EPCI × (pop_commune / pop_sans_rs)
 *
 * Garanti : sum(parts) = 1 sur l'ensemble de l'EPCI si toutes les RS sont connues.
 */
function calculerPartHybride(
  code_commune: string,
  pop_commune: number,
  rs_commune: number | null,
  rs_epci: number,
  communes_epci: { code: string; population: number }[],
  rs_par_commune: Map<string, number | null>,
): { part: number; methode: 'residences_secondaires' | 'rs_hybride' | 'population' } {
  if (rs_epci <= 0) {
    // Fallback : RS EPCI nulle ou absente
    const pop_total = communes_epci.reduce((s, c) => s + c.population, 0)
    return { part: pop_total > 0 ? pop_commune / pop_total : 0, methode: 'population' }
  }

  // Passe 1 : somme des RS connues et population des communes sans RS
  let rs_total_connu = 0
  let pop_sans_rs = 0

  for (const c of communes_epci) {
    const rs = rs_par_commune.get(c.code)
    if (rs !== null && rs !== undefined && rs > 0) {
      rs_total_connu += rs
    } else {
      pop_sans_rs += c.population
    }
  }

  // Cas : notre commune a une RS connue → part RS pure
  if (rs_commune !== null && rs_commune > 0) {
    return { part: rs_commune / rs_epci, methode: 'residences_secondaires' }
  }

  // Cas : notre commune n'a pas de RS → passe 2 (population sur montant résiduel)
  const part_rs_non_attribuee = Math.max(0, rs_epci - rs_total_connu) / rs_epci
  if (pop_sans_rs <= 0) {
    return { part: 0, methode: 'rs_hybride' }
  }

  return {
    part: part_rs_non_attribuee * (pop_commune / pop_sans_rs),
    methode: 'rs_hybride',
  }
}

// ─── Logique taxe de séjour ───────────────────────────────────────────────────

async function calculerTaxe(
  commune: CommuneInput,
  epci: InfosEpci | null,
  residences_secondaires_commune: number | null,
  residences_secondaires_epci: number | null,
): Promise<ResultatTaxe | null> {
  try {
    // Appels parallèles : taxe commune + taxe EPCI (si EPCI disponible)
    const [taxeCommune, taxeEpci] = await Promise.all([
      executerTaxe({ siren: commune.siren, type_collecteur: 'commune' }),
      epci ? executerTaxe({ siren: epci.siren_epci, type_collecteur: 'epci' }) : Promise.resolve(null),
    ])

    // Sélection du collecteur : commune en priorité, sinon EPCI
    if (taxeCommune.montant_taxe_euros > 0) {
      return {
        collecteur: 'commune',
        nom_collecteur: taxeCommune.lbudg || commune.nom,
        siren_collecteur: commune.siren,
        montant_total: taxeCommune.montant_taxe_euros,
        montant_estime_commune: null,
        part_epci_pct: null,
        methode_part: null,
        annee: taxeCommune.annee_donnees,
        nuitees_estimees: Math.round(taxeCommune.montant_taxe_euros / 1.50),
      }
    }

    if (taxeEpci && taxeEpci.montant_taxe_euros > 0 && epci) {
      // Prorata : résidences secondaires en priorité (meilleur proxy touristique), population en fallback
      let part: number
      let methode_part: 'residences_secondaires' | 'population'

      if (residences_secondaires_commune !== null && residences_secondaires_epci !== null && residences_secondaires_epci > 0) {
        part = residences_secondaires_commune / residences_secondaires_epci
        methode_part = 'residences_secondaires'
      } else {
        part = epci.population_epci > 0 ? commune.population / epci.population_epci : 0
        methode_part = 'population'
      }

      const montantEstime = Math.round(taxeEpci.montant_taxe_euros * part)

      return {
        collecteur: 'epci',
        nom_collecteur: taxeEpci.lbudg || epci.nom_epci,
        siren_collecteur: epci.siren_epci,
        montant_total: taxeEpci.montant_taxe_euros,
        montant_estime_commune: montantEstime,
        part_epci_pct: Math.round(part * 10000) / 100, // pourcentage avec 2 décimales
        methode_part,
        annee: taxeEpci.annee_donnees,
        nuitees_estimees: Math.round(taxeEpci.montant_taxe_euros / 1.50),
      }
    }

    // Taxe non instituée
    return {
      collecteur: 'non_institue',
      nom_collecteur: commune.nom,
      siren_collecteur: commune.siren,
      montant_total: 0,
      montant_estime_commune: null,
      part_epci_pct: null,
      methode_part: null,
      annee: taxeCommune.annee_donnees,
      nuitees_estimees: 0,
    }
  } catch (err) {
    console.error(`[Territoire/Analyser] Erreur taxe ${commune.nom} :`, err)
    return null
  }
}

// ─── Analyse d'une commune ────────────────────────────────────────────────────

async function analyserCommune(
  commune: CommuneInput,
  freq_departement: FrequentationINSEE | null
): Promise<ResultatCommune> {
  try {
    // Appels non-Mélodi en parallèle (pas de rate limit)
    const [stocks, epci] = await Promise.all([
      fetchStocks(commune.code_insee),
      fetchEpci(commune.code_insee),
    ])

    // Appels Mélodi séquentiels pour respecter le rate limit 30 req/min
    // (DS_RP_LOGEMENT_PRINC commune → EPCI → DS_TOUR_CAP — séquentiels pour éviter la rafale)
    const residences_secondaires = await fetchResidencesSecondaires(commune.code_insee)
    const residences_secondaires_epci = epci ? await fetchResidencesSecondairesEPCI(epci.siren_epci) : null
    const insee_cap = await fetchCapaciteINSEE(commune.code_insee)

    // Taxe de séjour (séquentielle car dépend de epci + résidences secondaires)
    const taxe = await calculerTaxe(commune, epci, residences_secondaires, residences_secondaires_epci)

    return {
      commune: {
        nom: commune.nom,
        code_insee: commune.code_insee,
        code_postal: commune.code_postal,
        code_departement: commune.code_departement,
      },
      hebergements: stocks.hebergements,
      poi: stocks.poi,
      taxe,
      residences_secondaires,
      insee_cap,
      freq_departement,
    }
  } catch (err) {
    console.error(`[Territoire/Analyser] Erreur commune ${commune.nom} :`, err)
    return {
      commune: {
        nom: commune.nom,
        code_insee: commune.code_insee,
        code_postal: commune.code_postal,
        code_departement: commune.code_departement,
      },
      hebergements: [],
      poi: [],
      taxe: null,
      residences_secondaires: null,
      insee_cap: null,
      freq_departement: null,
      erreur: err instanceof Error ? err.message : 'Erreur inconnue',
    }
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const communes: CommuneInput[] = body.communes ?? []

    if (!Array.isArray(communes) || communes.length === 0) {
      return NextResponse.json({ error: 'Paramètre communes requis (tableau)' }, { status: 400 })
    }

    if (communes.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 communes par requête' }, { status: 400 })
    }

    // Pré-chargement DS_TOUR_FREQ : une requête par département unique (évite les doublons)
    const deptsUniques = [...new Set(communes.map((c) => c.code_departement).filter(Boolean))]
    const freqParDept = new Map<string, FrequentationINSEE | null>()
    await Promise.all(
      deptsUniques.map(async (dept) => {
        const freq = await fetchFrequentationINSEE(dept)
        freqParDept.set(dept, freq)
      })
    )

    // Analyse en parallèle de toutes les communes
    const resultats = await Promise.all(
      communes.map((c) => analyserCommune(c, freqParDept.get(c.code_departement) ?? null))
    )

    // ── Enrichissement : prorata hybride RS+population sur EPCI complet ────────
    // Pour chaque EPCI collecteur, on récupère TOUTES ses communes (même hors sélection)
    // et on recalcule le prorata en deux passes pour chaque commune sélectionnée.

    // 1. Identifier les communes dont la taxe est collectée par un EPCI
    const communesEPCI: Array<{
      idx: number
      siren_epci: string
      code_insee: string
      population: number
      rs_commune: number | null
      montant_epci: number
      nom: string
    }> = []

    for (let i = 0; i < resultats.length; i++) {
      const r = resultats[i]
      const c = communes[i]
      if (r.taxe?.collecteur === 'epci' && r.taxe.siren_collecteur) {
        communesEPCI.push({
          idx: i,
          siren_epci: r.taxe.siren_collecteur,
          code_insee: c.code_insee,
          population: c.population,
          rs_commune: r.residences_secondaires,
          montant_epci: r.taxe.montant_total,
          nom: c.nom,
        })
      }
    }

    // 2. Traiter chaque EPCI unique
    const epciUniques = [...new Set(communesEPCI.map((c) => c.siren_epci))]

    for (const siren_epci of epciUniques) {
      const communesCetEPCI = communesEPCI.filter((c) => c.siren_epci === siren_epci)

      // RS totale de l'EPCI (dénominateur commun)
      const rs_epci = await fetchResidencesSecondairesEPCI(siren_epci)
      if (!rs_epci) {
        console.warn(`[ProratHybride] RS EPCI absente pour ${siren_epci} — prorata population conservé`)
        continue
      }

      // Toutes les communes de l'EPCI depuis geo.api.gouv.fr
      const toutes_communes = await fetchCommunesEPCI(siren_epci)
      if (toutes_communes.length === 0) {
        console.warn(`[ProratHybride] Liste communes vide pour EPCI ${siren_epci}`)
        continue
      }

      // RS déjà connues pour nos communes sélectionnées (évite de re-fetcher)
      const rs_deja_connues = new Map<string, number | null>()
      for (const c of communesCetEPCI) {
        rs_deja_connues.set(c.code_insee, c.rs_commune)
      }

      // Fetch RS pour toutes les autres communes de l'EPCI
      const rs_par_commune = await construireMapRSEPCI(toutes_communes, rs_deja_connues)

      // Recalcul du prorata hybride pour chaque commune sélectionnée
      for (const c of communesCetEPCI) {
        const { part, methode } = calculerPartHybride(
          c.code_insee,
          c.population,
          c.rs_commune,
          rs_epci,
          toutes_communes,
          rs_par_commune,
        )

        const montantEstime = Math.round(c.montant_epci * part)
        resultats[c.idx].taxe!.montant_estime_commune = montantEstime
        resultats[c.idx].taxe!.part_epci_pct = Math.round(part * 10000) / 100
        resultats[c.idx].taxe!.methode_part = methode

        console.log(`[ProratHybride] ${c.nom} → ${(part * 100).toFixed(2)}% (${methode}) = ${montantEstime.toLocaleString('fr-FR')} €`)
      }
    }

    // Statistiques globales
    const stats = {
      nb_communes: resultats.length,
      nb_hebergements: resultats.reduce((s, r) => s + r.hebergements.length, 0),
      nb_poi: resultats.reduce((s, r) => s + r.poi.length, 0),
      nb_taxe_commune: resultats.filter((r) => r.taxe?.collecteur === 'commune').length,
      nb_taxe_epci: resultats.filter((r) => r.taxe?.collecteur === 'epci').length,
      nb_taxe_non_institue: resultats.filter((r) => r.taxe?.collecteur === 'non_institue').length,
      nb_erreurs: resultats.filter((r) => r.erreur).length,
    }

    return NextResponse.json({ resultats, stats })
  } catch (err) {
    console.error('[Territoire/Analyser] Erreur :', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
