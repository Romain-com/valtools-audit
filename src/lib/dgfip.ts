/**
 * Client API DGFiP — data.economie.gouv.fr
 * Données comptables des communes et GFP (Taxe de séjour)
 *
 * Communes (M14) : 7311 forfaitaire, 7321 réelle
 * Communes (M57) : 7323 taxe de séjour
 * GFP/EPCI (M14) : 7346 taxe de séjour
 * GFP/EPCI (M57) : 7351 forfaitaire, 7352 réelle
 */

const COMMUNE_DATASET_PREFIX =
  "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/balances-comptables-des-communes-en-";

const GFP_DATASET =
  "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/balances-comptables-des-groupements-a-fiscalite-propre-depuis-2010/records";

const YEARS_TO_TRY = [2024, 2023, 2022];

const COMMUNE_ACCOUNTS = ["7311", "7321", "7323"];
const GFP_ACCOUNTS = ["7346", "7351", "7352"];

interface DGFiPRecord {
  compte: string;
  sc: number;
  obnetcre: number;
  nomen: string;
  lbudg: string;
}

interface DGFiPResponse {
  total_count: number;
  results: DGFiPRecord[];
}

export interface TaxeDetail {
  compte7311: number;
  compte7321: number;
  total: number;
}

export interface TaxeDeSejourResult {
  compte7311: number;
  compte7321: number;
  totalTaxe: number;
  source: "commune" | "epci" | "commune+epci" | "non_disponible";
  anneeReference: number;
  detailCommune: TaxeDetail | null;
  detailEpci: TaxeDetail | null;
}

/**
 * Récupère le code EPCI (SIREN) d'une commune via geo.api.gouv.fr
 */
async function getEpciSiren(codeInsee: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://geo.api.gouv.fr/communes/${codeInsee}?fields=codeEpci`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.codeEpci || null;
  } catch {
    return null;
  }
}

/**
 * Interroge le dataset communes pour les comptes taxe de séjour
 */
async function queryCommuneTaxe(
  sirenCommune: string,
  annee: number
): Promise<TaxeDetail | null> {
  const baseUrl = `${COMMUNE_DATASET_PREFIX}${annee}/records`;
  const accountsFilter = COMMUNE_ACCOUNTS.map((c) => `compte="${c}"`).join(
    " OR "
  );
  const where = `siren="${sirenCommune}" AND (${accountsFilter})`;

  const params = new URLSearchParams({ where, limit: "10" });
  const response = await fetch(`${baseUrl}?${params}`, {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return null;
  const data: DGFiPResponse = await response.json();
  if (data.results.length === 0) return null;

  return extractTaxeFromRecords(data.results);
}

/**
 * Interroge le dataset GFP pour les comptes taxe de séjour d'un EPCI
 */
async function queryEpciTaxe(
  sirenEpci: string,
  annee: number
): Promise<TaxeDetail | null> {
  const accountsFilter = GFP_ACCOUNTS.map((c) => `compte="${c}"`).join(" OR ");
  const where = `siren="${sirenEpci}" AND exer="${annee}" AND (${accountsFilter})`;

  const params = new URLSearchParams({ where, limit: "10" });
  const response = await fetch(`${GFP_DATASET}?${params}`, {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return null;
  const data: DGFiPResponse = await response.json();
  if (data.results.length === 0) return null;

  return extractTaxeFromRecords(data.results);
}

/**
 * Extrait les montants de taxe depuis les enregistrements DGFiP
 * Normalise vers compte7311 (forfaitaire) et compte7321 (réelle)
 */
function extractTaxeFromRecords(
  records: DGFiPRecord[]
): TaxeDetail | null {
  let forfaitaire = 0; // 7311 (M14), 7323 (M57 commune), 7346 (M14 GFP), 7351 (M57 GFP)
  let reelle = 0; // 7321 (M14), 7352 (M57 GFP)

  for (const record of records) {
    const montant = record.sc || record.obnetcre || 0;
    if (montant <= 0) continue;

    switch (record.compte) {
      case "7311": // M14 commune forfaitaire
      case "7323": // M57 commune (combiné → mis en forfaitaire)
      case "7346": // M14 GFP (combiné → mis en forfaitaire)
      case "7351": // M57 GFP forfaitaire
        forfaitaire += montant;
        break;
      case "7321": // M14 commune réelle
      case "7352": // M57 GFP réelle
        reelle += montant;
        break;
    }
  }

  const total = forfaitaire + reelle;
  if (total === 0) return null;

  return { compte7311: forfaitaire, compte7321: reelle, total };
}

/**
 * Récupère la taxe de séjour pour une commune par code INSEE et SIREN
 * Interroge le budget commune ET l'EPCI (dataset GFP séparé)
 * Essaie les années 2024, 2023, 2022 en cas de données manquantes
 */
export async function getTaxeDeSejour(
  codeInsee: string,
  sirenCommune: string
): Promise<TaxeDeSejourResult> {
  // Récupérer le SIREN EPCI via l'API Geo
  const sirenEpci = await getEpciSiren(codeInsee);

  for (const annee of YEARS_TO_TRY) {
    // Interroger commune et EPCI en parallèle
    const [communeData, epciData] = await Promise.all([
      queryCommuneTaxe(sirenCommune, annee).catch(() => null),
      sirenEpci
        ? queryEpciTaxe(sirenEpci, annee).catch(() => null)
        : Promise.resolve(null),
    ]);

    const communeTotal = communeData?.total ?? 0;
    const epciTotal = epciData?.total ?? 0;

    // Si aucune donnée pour cette année, essayer l'année suivante
    if (communeTotal === 0 && epciTotal === 0) continue;

    let source: "commune" | "epci" | "commune+epci";
    let best: TaxeDetail;

    if (communeTotal > 0 && epciTotal > 0) {
      source = "commune+epci";
      best = communeTotal >= epciTotal ? communeData! : epciData!;
    } else if (epciTotal > 0) {
      source = "epci";
      best = epciData!;
    } else {
      source = "commune";
      best = communeData!;
    }

    return {
      compte7311: best.compte7311,
      compte7321: best.compte7321,
      totalTaxe: best.total,
      source,
      anneeReference: annee,
      detailCommune: communeData,
      detailEpci: epciData,
    };
  }

  return {
    compte7311: 0,
    compte7321: 0,
    totalTaxe: 0,
    source: "non_disponible",
    anneeReference: YEARS_TO_TRY[0],
    detailCommune: null,
    detailEpci: null,
  };
}
