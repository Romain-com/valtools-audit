/**
 * Client API DGFiP — data.economie.gouv.fr
 * Données comptables des communes (Taxe de séjour)
 *
 * Nomenclature M14 (ancien) :
 * - 7311 : Taxe de séjour forfaitaire
 * - 7321 : Taxe de séjour au réel
 *
 * Nomenclature M57 (2024+) :
 * - 7323 : Taxe de séjour
 */

const DGFIP_BASE =
  "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/balances-comptables-des-communes-en-2024/records";

interface DGFiPRecord {
  siren: string;
  lbudg: string;
  compte: string;
  nomen: string;
  sd: number;
  sc: number;
  obnetdeb: number;
  obnetcre: number;
}

interface DGFiPResponse {
  total_count: number;
  results: DGFiPRecord[];
}

/**
 * Interroge la base DGFiP pour récupérer la taxe de séjour
 * Cherche dans les comptes M14 (7311, 7321) ET M57 (7323)
 */
async function getTaxeDeSejourBySiren(
  siren: string
): Promise<{ taxeForfaitaire: number; taxeReelle: number; taxeM57: number; nom: string; nomenclature: string }> {
  const params = new URLSearchParams({
    where: `siren="${siren}" AND (compte="7311" OR compte="7321" OR compte="7323")`,
    limit: "10",
  });

  const response = await fetch(`${DGFIP_BASE}?${params}`, {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`DGFiP ${response.status}: ${await response.text()}`);
  }

  const data: DGFiPResponse = await response.json();

  let taxeForfaitaire = 0;
  let taxeReelle = 0;
  let taxeM57 = 0;
  let nom = "";
  let nomenclature = "";

  for (const record of data.results) {
    nom = record.lbudg || nom;
    nomenclature = record.nomen || nomenclature;
    const montant = record.sc || record.obnetcre || 0;
    if (record.compte === "7311") {
      taxeForfaitaire = montant;
    } else if (record.compte === "7321") {
      taxeReelle = montant;
    } else if (record.compte === "7323") {
      taxeM57 = montant;
    }
  }

  return { taxeForfaitaire, taxeReelle, taxeM57, nom, nomenclature };
}

export interface CommuneInfo {
  nom: string;
  siren: string;
  codeInsee: string;
  codeDepartement: string;
  codeRegion: string;
  population: number;
  codePostal: string;
}

/**
 * Récupère la taxe de séjour pour une commune (par SIREN)
 * et son EPCI si disponible
 */
export async function getTaxeDeSejour(
  sirenCommune: string,
  sirenEpci?: string
): Promise<{
  commune: { taxeForfaitaire: number; taxeReelle: number; taxeM57: number; total: number; nom: string; nomenclature: string };
  epci: { taxeForfaitaire: number; taxeReelle: number; taxeM57: number; total: number; nom: string; nomenclature: string } | null;
  source: "commune" | "epci" | "commune+epci";
  totalTaxe: number;
}> {
  const commune = await getTaxeDeSejourBySiren(sirenCommune);
  const communeTotal = commune.taxeForfaitaire + commune.taxeReelle + commune.taxeM57;

  let epci: { taxeForfaitaire: number; taxeReelle: number; taxeM57: number; nom: string; nomenclature: string } | null = null;
  let epciTotal = 0;

  if (sirenEpci) {
    try {
      epci = await getTaxeDeSejourBySiren(sirenEpci);
      epciTotal = epci.taxeForfaitaire + epci.taxeReelle + epci.taxeM57;
    } catch {
      console.warn("[DGFiP] EPCI non trouvé pour SIREN:", sirenEpci);
    }
  }

  let source: "commune" | "epci" | "commune+epci";
  let totalTaxe: number;

  if (communeTotal > 0 && epciTotal > 0) {
    source = "commune+epci";
    totalTaxe = Math.max(communeTotal, epciTotal);
  } else if (epciTotal > 0) {
    source = "epci";
    totalTaxe = epciTotal;
  } else {
    source = "commune";
    totalTaxe = communeTotal;
  }

  return {
    commune: { ...commune, total: communeTotal },
    epci: epci ? { ...epci, total: epciTotal } : null,
    source,
    totalTaxe,
  };
}
