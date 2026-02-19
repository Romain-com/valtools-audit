import { StocksPhysiquesInput, StocksPhysiquesOutput } from "@/types/audit";
import { askLLMJson } from "@/lib/llm";
import {
  getHebergements,
  getActivites,
  getRestauration,
  type DatatourismeSearchResult,
} from "@/lib/datatourisme";
import { trackApiCall } from "@/lib/api-tracker";
import { API_COSTS } from "@/lib/api-costs";

// ============================================
// MODULE 5 — STOCKS PHYSIQUES
// ============================================

function classifyAccommodation(item: DatatourismeSearchResult): string {
  const types = item["@type"] || [];
  const typesStr = types.join(" ").toLowerCase();
  if (typesStr.includes("hotel")) return "Hotel";
  if (typesStr.includes("camping")) return "Camping";
  if (typesStr.includes("guesthouse") || typesStr.includes("chambredhotes")) return "Chambre d'hôtes";
  if (typesStr.includes("rentalaccommodation") || typesStr.includes("meuble")) return "Meublé classé";
  return "Autre hébergement";
}

function classifyActivity(item: DatatourismeSearchResult): string {
  const types = item["@type"] || [];
  const typesStr = types.join(" ").toLowerCase();
  if (typesStr.includes("culturalsite") || typesStr.includes("museum")) return "Site culturel";
  if (typesStr.includes("sportsandleisure") || typesStr.includes("sport")) return "Sport & Loisirs";
  if (typesStr.includes("naturalheritage") || typesStr.includes("natural")) return "Patrimoine naturel";
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

function getCapacity(item: DatatourismeSearchResult): number {
  return item.schema_capacity || item.allowedPersons || 0;
}

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
  input: StocksPhysiquesInput,
  auditId?: string | null
): Promise<StocksPhysiquesOutput> {
  const { destination, codeInsee } = input;

  // 3 requêtes Datatourisme en parallèle avec fallback DataForSEO
  const [hebData, actData, restData] = await Promise.all([
    trackApiCall({
      auditId, apiName: "datatourisme", endpoint: "hebergements",
      call: () => getHebergements(codeInsee, destination),
      estimateCost: () => 0,
    }).catch(() => ({ results: [] as DatatourismeSearchResult[], estimationGoogle: 0 })),
    trackApiCall({
      auditId, apiName: "datatourisme", endpoint: "activites",
      call: () => getActivites(codeInsee, destination),
      estimateCost: () => 0,
    }).catch(() => ({ results: [] as DatatourismeSearchResult[], estimationGoogle: 0 })),
    trackApiCall({
      auditId, apiName: "datatourisme", endpoint: "restauration",
      call: () => getRestauration(codeInsee, destination),
      estimateCost: () => 0,
    }).catch(() => ({ results: [] as DatatourismeSearchResult[], estimationGoogle: 0 })),
  ]);

  const hebergementsRaw = hebData.results;
  const activitesRaw = actData.results;
  const restaurationRaw = restData.results;
  const estimationsGoogle = {
    hebergements: hebData.estimationGoogle || 0,
    activites: actData.estimationGoogle || 0,
    restauration: restData.estimationGoogle || 0,
  };

  const hebergementsDetail = aggregateByType(hebergementsRaw, classifyAccommodation);
  const capaciteTotale = hebergementsRaw.reduce((sum, item) => sum + getCapacity(item), 0);
  const activitesDetail = aggregateByType(activitesRaw, classifyActivity);
  const restaurationDetail = aggregateByType(restaurationRaw, classifyRestauration);

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

  const totalHebFinal = hebergementsRaw.length || estimationsGoogle.hebergements;
  const totalActFinal = activitesRaw.length || estimationsGoogle.activites;
  const totalRestFinal = restaurationRaw.length || estimationsGoogle.restauration;
  const sourceDonnees = hebergementsRaw.length > 0 ? "Datatourisme" : "Estimation Google";

  // LLM — analyse
  const llmPrompt = `Voici les données de l'inventaire pour ${destination} (Code INSEE ${codeInsee}).
Source : ${sourceDonnees}
Données JSON :
${JSON.stringify({ source: sourceDonnees, hebergements: { total: totalHebFinal, capacite: capaciteTotale, detail: hebergementsDetail }, activites: { total: totalActFinal, detail: activitesDetail }, restauration: { total: totalRestFinal, detail: restaurationDetail } }, null, 2)}

Tâche :
Crée un tableau synthétique par catégorie (Hébergement / Activité / Restauration).
Calcule la 'Capacité d'accueil théorique' (Somme des capacités hébergements).
Identifie la dominante de l'offre :
Si > 60% d'hébergements de plein air -> 'Destination Nature/Camping'.
Si > 50% d'hôtels -> 'Destination Urbaine/Affaires'.
Met aussi en évidence ce que tu retrouves dans les activités et les services. Fait une analyse de la situation.
Sortie JSON : { "analyse": "..." }`;

  let analyse: string;
  try {
    const result = await trackApiCall({
      auditId, apiName: "openai", endpoint: "chat/completions",
      call: () => askLLMJson<{ analyse: string }>(llmPrompt, "Agis comme un gestionnaire de destination."),
      estimateCost: () => Math.ceil(llmPrompt.length / 4) * API_COSTS.openai.promptTokenCost + 200 * API_COSTS.openai.completionTokenCost,
    });
    analyse = result.analyse;
  } catch {
    analyse = `${destination} dispose de ${totalHebFinal} hébergements (${capaciteTotale} places), ${totalActFinal} activités et ${totalRestFinal} restaurants/services. Profil : ${profilDominant}. Source : ${sourceDonnees}.`;
  }

  return {
    hebergements: { total: totalHebFinal, capacite: capaciteTotale, detail: hebergementsDetail },
    activites: { total: totalActFinal, detail: activitesDetail },
    restauration: { total: totalRestFinal, detail: restaurationDetail },
    profilDominant,
    analyse,
  };
}
