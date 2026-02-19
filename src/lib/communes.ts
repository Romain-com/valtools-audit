import { readFile } from "fs/promises";
import { join } from "path";

export interface CommuneData {
  nom: string;
  siren: string;
  cog: string; // Code INSEE
  type: string;
  codeDepartement: string;
  codeDepartement3digits: string;
  codeRegion: string;
  population: number;
  codePostal: string;
}

export interface EpciData {
  nom: string;
  siren: string;
  type: string;
  codeDepartement: string;
  codeRegion: string;
  population: number;
}

let communesCache: CommuneData[] | null = null;
let epciCache: EpciData[] | null = null;

/**
 * Charge et parse le CSV des communes
 */
export async function loadCommunes(): Promise<CommuneData[]> {
  if (communesCache) return communesCache;

  const csvPath = join(
    process.cwd(),
    "ressources",
    "identifiants-communes-2024.csv"
  );
  const content = await readFile(csvPath, "utf-8");
  const lines = content.trim().split("\n");

  // Header: nom,SIREN,COG,type,code_departement,code_departement_3digits,code_region,population,code_postal
  communesCache = lines.slice(1).map((line) => {
    const parts = line.split(",");
    return {
      nom: parts[0],
      siren: parts[1],
      cog: parts[2],
      type: parts[3],
      codeDepartement: parts[4],
      codeDepartement3digits: parts[5],
      codeRegion: parts[6],
      population: parseInt(parts[7], 10) || 0,
      codePostal: parts[8],
    };
  });

  return communesCache;
}

/**
 * Charge et parse le CSV des EPCI
 */
export async function loadEpci(): Promise<EpciData[]> {
  if (epciCache) return epciCache;

  const csvPath = join(
    process.cwd(),
    "ressources",
    "identifiants-epci-2024.csv"
  );
  const content = await readFile(csvPath, "utf-8");
  const lines = content.trim().split("\n");

  // Header: nom,SIREN,type,code_departement,code_region,population
  epciCache = lines.slice(1).map((line) => {
    const parts = line.split(",");
    return {
      nom: parts[0],
      siren: parts[1],
      type: parts[2],
      codeDepartement: parts[3],
      codeRegion: parts[4],
      population: parseInt(parts[5], 10) || 0,
    };
  });

  return epciCache;
}

/**
 * Trouve une commune par code INSEE
 */
export async function findCommuneByInsee(
  codeInsee: string
): Promise<CommuneData | null> {
  const communes = await loadCommunes();
  return communes.find((c) => c.cog === codeInsee) || null;
}

/**
 * Trouve une commune par nom (recherche approximative)
 */
export async function findCommuneByNom(
  nom: string
): Promise<CommuneData | null> {
  const communes = await loadCommunes();
  const normalized = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    communes.find(
      (c) =>
        c.nom
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase() === normalized
    ) || null
  );
}

/**
 * Trouve un EPCI par département (simplifié)
 */
export async function findEpciByDepartement(
  codeDept: string
): Promise<EpciData[]> {
  const epcis = await loadEpci();
  return epcis.filter((e) => e.codeDepartement === codeDept);
}
