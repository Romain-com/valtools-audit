/**
 * Client API DGFiP — data.economie.gouv.fr
 * Données comptables des communes (Taxe de séjour)
 *
 * Comptes recherchés :
 * - 7311 : Taxe de séjour forfaitaire (campings, résidences)
 * - 7321 : Taxe de séjour au réel (hôtels, Airbnb, gîtes)
 */

const DGFIP_BASE =
  "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/balances-comptables-des-communes-en-2024/records";

interface DGFiPRecord {
  siren: string;
  nom: string;
  compte: string;
  sd: number; // Solde Débiteur
  sc: number; // Solde Créditeur
  obnetdeb: number;
  obnetcre: number;
}

interface DGFiPResponse {
  total_count: number;
  results: DGFiPRecord[];
}

/**
 * Interroge la base DGFiP pour récupérer la taxe de séjour
 * d'une entité (commune ou EPCI) via son SIREN
 */
async function getTaxeDeSejourBySiren(
  siren: string
): Promise<{ taxeForfaitaire: number; taxeReelle: number; nom: string }> {
  const params = new URLSearchParams({
    where: `siren = "${siren}" AND (compte = "7311" OR compte = "7321")`,
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
  let nom = "";

  for (const record of data.results) {
    nom = record.nom || nom;
    // Le montant pertinent est le solde créditeur (recettes)
    const montant = record.sc || record.obnetcre || 0;
    if (record.compte === "7311") {
      taxeForfaitaire = montant;
    } else if (record.compte === "7321") {
      taxeReelle = montant;
    }
  }

  return { taxeForfaitaire, taxeReelle, nom };
}

/**
 * Recherche le SIREN d'une commune par code INSEE
 * dans le fichier CSV des identifiants communes
 */
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
  commune: { taxeForfaitaire: number; taxeReelle: number; total: number; nom: string };
  epci: { taxeForfaitaire: number; taxeReelle: number; total: number; nom: string } | null;
  source: "commune" | "epci" | "commune+epci";
  totalTaxe: number;
}> {
  // Récupérer la taxe commune
  const commune = await getTaxeDeSejourBySiren(sirenCommune);
  const communeTotal = commune.taxeForfaitaire + commune.taxeReelle;

  // Récupérer la taxe EPCI si SIREN fourni
  let epci: { taxeForfaitaire: number; taxeReelle: number; nom: string } | null = null;
  let epciTotal = 0;

  if (sirenEpci) {
    try {
      epci = await getTaxeDeSejourBySiren(sirenEpci);
      epciTotal = epci.taxeForfaitaire + epci.taxeReelle;
    } catch {
      console.warn("[DGFiP] EPCI non trouvé pour SIREN:", sirenEpci);
    }
  }

  // Déterminer la source la plus pertinente
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
