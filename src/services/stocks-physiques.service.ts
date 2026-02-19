import { StocksPhysiquesInput, StocksPhysiquesOutput } from "@/types/audit";
import { askLLMJson } from "@/lib/llm";
import {
  searchByInsee,
  type DatatourismeSearchResult,
} from "@/lib/datatourisme";

// ============================================
// MODULE 5 — STOCKS PHYSIQUES
// ============================================

/**
 * Classe les résultats Datatourisme par sous-type
 */
function classifyAccommodation(
  item: DatatourismeSearchResult
): string {
  const types = item["@type"] || [];
  const typesStr = types.join(" ").toLowerCase();

  if (typesStr.includes("hotel")) return "Hotel";
  if (typesStr.includes("camping")) return "Camping";
  if (typesStr.includes("guesthouse") || typesStr.includes("chambredhotes"))
    return "Chambre d'hôtes";
  if (
    typesStr.includes("rentalaccommodation") ||
    typesStr.includes("meuble")
  )
    return "Meublé classé";
  return "Autre hébergement";
}

function classifyActivity(item: DatatourismeSearchResult): string {
  const types = item["@type"] || [];
  const typesStr = types.join(" ").toLowerCase();

  if (typesStr.includes("culturalsite") || typesStr.includes("museum"))
    return "Site culturel";
  if (typesStr.includes("sportsandleisure") || typesStr.includes("sport"))
    return "Sport & Loisirs";
  if (typesStr.includes("naturalheritage") || typesStr.includes("natural"))
    return "Patrimoine naturel";
  return "Autre activité";
}

function classifyRestauration(item: DatatourismeSearchResult): string {
  const types = item["@type"] || [];
  const typesStr = types.join(" ").toLowerCase();

  if (typesStr.includes("restaurant")) return "Restaurant";
  if (typesStr.includes("bar")) return "Bar / Pub";
  if (typesStr.includes("touristinformation")) return "Office de Tourisme";
  return "Autre service";
}

/**
 * Récupère la capacité d'un hébergement
 */
function getCapacity(item: DatatourismeSearchResult): number {
  return item.schema_capacity || item.allowedPersons || 0;
}

/**
 * Agrège les résultats par catégorie
 */
function aggregateByType(
  items: DatatourismeSearchResult[],
  classifyFn: (item: DatatourismeSearchResult) => string
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const type = classifyFn(item);
    result[type] = (result[type] || 0) + 1;
  }
  return result;
}

export async function runStocksPhysiques(
  input: StocksPhysiquesInput
): Promise<StocksPhysiquesOutput> {
  const { destination, codeInsee } = input;

  // 3 requêtes distinctes par type (en parallèle)
  const [hebergementsRaw, activitesRaw, restaurationRaw] = await Promise.all([
    searchByInsee(codeInsee, ["schema:Accommodation"]).catch(() => []),
    searchByInsee(codeInsee, [
      "schema:CulturalSite",
      "schema:SportsAndLeisurePlace",
      "schema:NaturalHeritage",
    ]).catch(() => []),
    searchByInsee(codeInsee, [
      "schema:Restaurant",
      "schema:BarOrPub",
      "schema:TouristInformationCenter",
    ]).catch(() => []),
  ]);

  // Agrégation hébergements
  const hebergementsDetail = aggregateByType(
    hebergementsRaw,
    classifyAccommodation
  );
  const capaciteTotale = hebergementsRaw.reduce(
    (sum, item) => sum + getCapacity(item),
    0
  );

  // Agrégation activités
  const activitesDetail = aggregateByType(activitesRaw, classifyActivity);

  // Agrégation restauration
  const restaurationDetail = aggregateByType(
    restaurationRaw,
    classifyRestauration
  );

  // Détermination du profil dominant (algorithmique)
  const campingCount = hebergementsDetail["Camping"] || 0;
  const hotelCount = hebergementsDetail["Hotel"] || 0;
  const totalHeb = hebergementsRaw.length || 1;

  let profilDominant: string;
  if (campingCount / totalHeb > 0.6) {
    profilDominant = "Destination Nature/Camping";
  } else if (hotelCount / totalHeb > 0.5) {
    profilDominant = "Destination Urbaine/Affaires";
  } else {
    profilDominant = "Destination mixte";
  }

  // Analyse LLM
  let analyse: string;
  try {
    const stockData = {
      hebergements: {
        total: hebergementsRaw.length,
        capacite: capaciteTotale,
        detail: hebergementsDetail,
      },
      activites: { total: activitesRaw.length, detail: activitesDetail },
      restauration: {
        total: restaurationRaw.length,
        detail: restaurationDetail,
      },
    };

    const result = await askLLMJson<{ analyse: string }>(
      `Voici les données brutes de l'inventaire Datatourisme pour ${destination} (Code INSEE ${codeInsee}).
Données JSON :
${JSON.stringify(stockData, null, 2)}

Tâche :
Crée un tableau synthétique par catégorie (Hébergement / Activité / Restauration).
Calcule la 'Capacité d'accueil théorique' (Somme des capacités hébergements).
Identifie la dominante de l'offre :
Si > 60% d'hébergements de plein air -> 'Destination Nature/Camping'.
Si > 50% d'hôtels -> 'Destination Urbaine/Affaires'.
Met aussi en évidence ce que tu retrouves dans les activités et les services. Fait une analyse de la situation.
Sortie JSON : { "analyse": "..." }`,
      "Agis comme un gestionnaire de destination."
    );
    analyse = result.analyse;
  } catch {
    analyse = `${destination} dispose de ${hebergementsRaw.length} hébergements (${capaciteTotale} places), ${activitesRaw.length} activités et ${restaurationRaw.length} restaurants/services. Profil : ${profilDominant}.`;
  }

  return {
    hebergements: {
      total: hebergementsRaw.length,
      capacite: capaciteTotale,
      detail: hebergementsDetail,
    },
    activites: {
      total: activitesRaw.length,
      detail: activitesDetail,
    },
    restauration: {
      total: restaurationRaw.length,
      detail: restaurationDetail,
    },
    profilDominant,
    analyse,
  };
}
