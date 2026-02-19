const DATATOURISME_API = "https://api.datatourisme.fr/api/v1";

interface DatatourismeSearchResult {
  "@id": string;
  "rdfs:label"?: Record<string, string[]>;
  "rdfs:comment"?: Record<string, string[]>;
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

interface DatatourismeResponse {
  "hydra:member": DatatourismeSearchResult[];
  "hydra:totalItems": number;
}

/**
 * Recherche sur l'API Datatourisme par nom de commune
 */
export async function searchByCommune(
  communeName: string,
  types?: string[]
): Promise<DatatourismeSearchResult[]> {
  const params = new URLSearchParams({
    "communes.label": communeName,
    first: "50",
  });
  if (types && types.length > 0) {
    params.set("types", types.join(","));
  }

  const response = await fetch(
    `${DATATOURISME_API}/datatourisme/search?${params}`,
    { signal: AbortSignal.timeout(15000) }
  );

  if (!response.ok) {
    throw new Error(`Datatourisme ${response.status}: ${await response.text()}`);
  }

  const data: DatatourismeResponse = await response.json();
  return data["hydra:member"] || [];
}

/**
 * Recherche par code INSEE (plus précis pour éviter les homonymes)
 */
export async function searchByInsee(
  codeInsee: string,
  types?: string[]
): Promise<DatatourismeSearchResult[]> {
  const params = new URLSearchParams({
    "communes.codeInsee": codeInsee,
    first: "100",
  });
  if (types && types.length > 0) {
    params.set("types", types.join(","));
  }

  const response = await fetch(
    `${DATATOURISME_API}/datatourisme/search?${params}`,
    { signal: AbortSignal.timeout(15000) }
  );

  if (!response.ok) {
    throw new Error(`Datatourisme ${response.status}: ${await response.text()}`);
  }

  const data: DatatourismeResponse = await response.json();
  return data["hydra:member"] || [];
}

/**
 * Récupère la description d'une destination (POI Office de Tourisme ou Zone Géo)
 */
export async function getDestinationDescription(
  communeName: string
): Promise<string | null> {
  try {
    // Chercher les POI de type Office de Tourisme ou Zone Géographique
    const results = await searchByCommune(communeName, [
      "schema:TouristInformationCenter",
    ]);

    for (const item of results) {
      // Priorité : description longue FR
      const descriptions = item.hasDescription || [];
      for (const desc of descriptions) {
        const longFr = desc.description?.fr?.[0];
        if (longFr) return longFr;
        const shortFr = desc.shortDescription?.fr?.[0];
        if (shortFr) return shortFr;
      }

      // Fallback : rdfs:comment
      const comment = item["rdfs:comment"]?.fr?.[0];
      if (comment) return comment;
    }

    // Si pas de résultat OT, chercher tout POI avec description
    const allResults = await searchByCommune(communeName);
    for (const item of allResults) {
      const comment = item["rdfs:comment"]?.fr?.[0];
      if (comment && comment.length > 50) return comment;
    }

    return null;
  } catch (error) {
    console.warn("[Datatourisme] Erreur:", error);
    return null;
  }
}

/**
 * Récupère les hébergements par code INSEE
 */
export async function getHebergements(codeInsee: string) {
  return searchByInsee(codeInsee, ["schema:Accommodation"]);
}

/**
 * Récupère les activités/loisirs par code INSEE
 */
export async function getActivites(codeInsee: string) {
  return searchByInsee(codeInsee, [
    "schema:CulturalSite",
    "schema:SportsAndLeisurePlace",
    "schema:NaturalHeritage",
  ]);
}

/**
 * Récupère la restauration et services par code INSEE
 */
export async function getRestauration(codeInsee: string) {
  return searchByInsee(codeInsee, [
    "schema:Restaurant",
    "schema:BarOrPub",
    "schema:TouristInformationCenter",
  ]);
}

export type { DatatourismeSearchResult };
