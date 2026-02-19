import { googleResultsCount } from "./dataforseo";

const DATATOURISME_API = "https://api.datatourisme.fr/v1";
const DIFFUSEUR_BASE = "https://diffuseur.datatourisme.fr/webservice";

interface DatatourismeResult {
  "@id"?: string;
  "rdfs:label"?: Record<string, string[]>;
  "rdfs:comment"?: Record<string, string[]>;
  "schema:name"?: string;
  hasDescription?: Array<{
    shortDescription?: Record<string, string[]>;
    description?: Record<string, string[]>;
  }>;
  "@type"?: string[];
  isLocatedAt?: Array<{
    schema_address?: Array<{
      schema_addressLocality?: string;
      schema_postalCode?: string;
      hasAddressCity?: { insee?: string };
    }>;
  }>;
  schema_capacity?: number;
  allowedPersons?: number;
}

interface CatalogResponse {
  data: DatatourismeResult[];
  total: number;
}

/**
 * Tente l'API REST Datatourisme (/v1/catalog) avec filtres INSEE
 */
async function queryCatalog(
  codeInsee: string,
  typeFilter?: string,
  pageSize: number = 100
): Promise<DatatourismeResult[]> {
  const fluxId = process.env.DATATOURISME_FLUX_ID;
  const appKey = process.env.DATATOURISME_APP_KEY;

  if (!appKey) {
    throw new Error("DATATOURISME_APP_KEY manquante");
  }

  // Essai 1 : API REST /v1/catalog avec la clé
  const params = new URLSearchParams({
    page_size: String(pageSize),
    api_key: appKey,
  });

  // Filtre par INSEE du département (les 2 premiers chiffres du code INSEE)
  const deptCode = codeInsee.substring(0, 2);
  let filters = `isLocatedAt.address.hasAddressCity.insee[eq]=${codeInsee}`;
  if (typeFilter) {
    filters += `&@type[eq]=${typeFilter}`;
  }
  params.set("filters", filters);

  const response = await fetch(`${DATATOURISME_API}/catalog?${params}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    // Essai 2 : endpoint diffuseur
    return queryDiffuseur(codeInsee, typeFilter);
  }

  const data: CatalogResponse = await response.json();
  return data.data || [];
}

/**
 * Fallback : endpoint diffuseur Datatourisme
 */
async function queryDiffuseur(
  codeInsee: string,
  typeFilter?: string
): Promise<DatatourismeResult[]> {
  const fluxId = process.env.DATATOURISME_FLUX_ID;
  const appKey = process.env.DATATOURISME_APP_KEY;

  if (!fluxId || !appKey) {
    throw new Error("Clés Datatourisme diffuseur manquantes");
  }

  const response = await fetch(
    `${DIFFUSEUR_BASE}/${fluxId}/${appKey}`,
    { signal: AbortSignal.timeout(20000) }
  );

  if (!response.ok) {
    throw new Error(`Datatourisme diffuseur ${response.status}`);
  }

  // Le diffuseur retourne un JSON-LD complet, on filtre côté client
  const data = await response.json();
  const items: DatatourismeResult[] = Array.isArray(data) ? data : data["@graph"] || [];

  return items.filter((item) => {
    // Filtre par INSEE
    const locations = item.isLocatedAt || [];
    const matchInsee = locations.some((loc) =>
      loc.schema_address?.some((addr) => addr.hasAddressCity?.insee === codeInsee)
    );
    if (!matchInsee) return false;

    // Filtre par type si spécifié
    if (typeFilter && item["@type"]) {
      return item["@type"].some((t) => t.includes(typeFilter));
    }
    return true;
  });
}

/**
 * Fallback ultime : estimation via DataForSEO (Google Dorking)
 */
async function estimateFromGoogle(
  destination: string,
  category: string
): Promise<number> {
  try {
    return await googleResultsCount(
      `site:datatourisme.fr "${destination}" "${category}"`
    );
  } catch {
    return 0;
  }
}

/**
 * Recherche par code INSEE avec cascade : API REST → Diffuseur → DataForSEO
 */
export async function searchByInsee(
  codeInsee: string,
  types?: string[]
): Promise<DatatourismeResult[]> {
  try {
    const typeFilter = types?.[0]?.replace("schema:", "") || undefined;
    return await queryCatalog(codeInsee, typeFilter);
  } catch (error) {
    console.warn("[Datatourisme] API indisponible, fallback DataForSEO:", error);
    return [];
  }
}

/**
 * Recherche par nom de commune (fallback si pas de code INSEE)
 */
export async function searchByCommune(
  communeName: string,
  types?: string[]
): Promise<DatatourismeResult[]> {
  const appKey = process.env.DATATOURISME_APP_KEY;
  if (!appKey) return [];

  try {
    const params = new URLSearchParams({
      page_size: "50",
      api_key: appKey,
      search: communeName,
    });

    const response = await fetch(`${DATATOURISME_API}/catalog?${params}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const data: CatalogResponse = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}

/**
 * Récupère la description d'une destination
 */
export async function getDestinationDescription(
  communeName: string
): Promise<string | null> {
  try {
    const results = await searchByCommune(communeName);
    for (const item of results) {
      const descriptions = item.hasDescription || [];
      for (const desc of descriptions) {
        const longFr = desc.description?.fr?.[0];
        if (longFr) return longFr;
        const shortFr = desc.shortDescription?.fr?.[0];
        if (shortFr) return shortFr;
      }
      const comment = item["rdfs:comment"]?.fr?.[0];
      if (comment && comment.length > 50) return comment;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Hébergements par code INSEE — avec fallback estimation Google
 */
export async function getHebergements(
  codeInsee: string,
  destination?: string
): Promise<{ results: DatatourismeResult[]; estimationGoogle?: number }> {
  const results = await searchByInsee(codeInsee, ["schema:Accommodation"]);
  if (results.length > 0) return { results };

  // Fallback : estimation via DataForSEO
  const estimation = destination
    ? await estimateFromGoogle(destination, "hébergement")
    : 0;
  return { results: [], estimationGoogle: estimation };
}

/**
 * Activités par code INSEE — avec fallback estimation Google
 */
export async function getActivites(
  codeInsee: string,
  destination?: string
): Promise<{ results: DatatourismeResult[]; estimationGoogle?: number }> {
  const results = await searchByInsee(codeInsee, ["schema:CulturalSite"]);
  if (results.length > 0) return { results };

  const estimation = destination
    ? await estimateFromGoogle(destination, "activité loisir")
    : 0;
  return { results: [], estimationGoogle: estimation };
}

/**
 * Restauration par code INSEE — avec fallback estimation Google
 */
export async function getRestauration(
  codeInsee: string,
  destination?: string
): Promise<{ results: DatatourismeResult[]; estimationGoogle?: number }> {
  const results = await searchByInsee(codeInsee, ["schema:Restaurant"]);
  if (results.length > 0) return { results };

  const estimation = destination
    ? await estimateFromGoogle(destination, "restaurant")
    : 0;
  return { results: [], estimationGoogle: estimation };
}

export type { DatatourismeResult as DatatourismeSearchResult };
