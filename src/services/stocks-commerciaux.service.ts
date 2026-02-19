import { StocksCommerciauxInput, StocksCommerciauxOutput } from "@/types/audit";
import { askLLMJson } from "@/lib/llm";
import { googleResultsCount } from "@/lib/dataforseo";
import { trackApiCall } from "@/lib/api-tracker";
import { API_COSTS } from "@/lib/api-costs";

// ============================================
// MODULE 6 — STOCKS COMMERCIAUX
// ============================================

/**
 * Requêtes Google Dorking par plateforme
 */
const DORKING_QUERIES = {
  hebergement: {
    airbnb: (ville: string) => `site:airbnb.fr/rooms "${ville}"`,
    booking: (ville: string) => `site:booking.com/hotel "${ville}"`,
    abritel: (ville: string) => `site:abritel.fr "location" "${ville}"`,
  },
  activites: {
    tripadvisor: (ville: string) =>
      `site:tripadvisor.fr "Attractions" "${ville}"`,
    getyourguide: (ville: string) =>
      `site:getyourguide.fr "${ville}"`,
  },
  restauration: {
    thefork: (ville: string) => `site:thefork.fr "${ville}"`,
    michelin: (ville: string) =>
      `site:guide.michelin.com "${ville}"`,
  },
};

export async function runStocksCommerciaux(
  input: StocksCommerciauxInput,
  auditId?: string | null
): Promise<StocksCommerciauxOutput> {
  const { destination, stocksPhysiques } = input;

  // Lancer toutes les requêtes de dorking en parallèle
  const [airbnb, booking, abritel, tripadvisor, getyourguide, thefork, michelin] =
    await Promise.all([
      trackApiCall({
        auditId,
        apiName: "dataforseo",
        endpoint: "google/resultsCount",
        call: () => googleResultsCount(DORKING_QUERIES.hebergement.airbnb(destination)),
        estimateCost: () => API_COSTS.dataforseo.resultsCount,
      }).catch(() => 0),
      trackApiCall({
        auditId,
        apiName: "dataforseo",
        endpoint: "google/resultsCount",
        call: () => googleResultsCount(DORKING_QUERIES.hebergement.booking(destination)),
        estimateCost: () => API_COSTS.dataforseo.resultsCount,
      }).catch(() => 0),
      trackApiCall({
        auditId,
        apiName: "dataforseo",
        endpoint: "google/resultsCount",
        call: () => googleResultsCount(DORKING_QUERIES.hebergement.abritel(destination)),
        estimateCost: () => API_COSTS.dataforseo.resultsCount,
      }).catch(() => 0),
      trackApiCall({
        auditId,
        apiName: "dataforseo",
        endpoint: "google/resultsCount",
        call: () => googleResultsCount(DORKING_QUERIES.activites.tripadvisor(destination)),
        estimateCost: () => API_COSTS.dataforseo.resultsCount,
      }).catch(() => 0),
      trackApiCall({
        auditId,
        apiName: "dataforseo",
        endpoint: "google/resultsCount",
        call: () => googleResultsCount(DORKING_QUERIES.activites.getyourguide(destination)),
        estimateCost: () => API_COSTS.dataforseo.resultsCount,
      }).catch(() => 0),
      trackApiCall({
        auditId,
        apiName: "dataforseo",
        endpoint: "google/resultsCount",
        call: () => googleResultsCount(DORKING_QUERIES.restauration.thefork(destination)),
        estimateCost: () => API_COSTS.dataforseo.resultsCount,
      }).catch(() => 0),
      trackApiCall({
        auditId,
        apiName: "dataforseo",
        endpoint: "google/resultsCount",
        call: () => googleResultsCount(DORKING_QUERIES.restauration.michelin(destination)),
        estimateCost: () => API_COSTS.dataforseo.resultsCount,
      }).catch(() => 0),
    ]);

  // Calcul Digital Coverage (algorithmique)
  const stockPhysiqueHeb = stocksPhysiques.hebergements.total || 1;
  const stockPhysiqueAct = stocksPhysiques.activites.total || 1;

  const stockCommercialHeb = airbnb + booking + abritel;
  const stockCommercialAct = tripadvisor + getyourguide;

  const digitalCoverageHeb = Math.round(
    (stockCommercialHeb / stockPhysiqueHeb) * 100
  );
  const digitalCoverageAct = Math.round(
    (stockCommercialAct / stockPhysiqueAct) * 100
  );

  // Alertes algorithmiques
  const alertes: string[] = [];
  if (booking > stockPhysiqueHeb) {
    alertes.push(
      `Alerte dépendance : ${booking} résultats Booking vs ${stockPhysiqueHeb} hébergements physiques. Les OTA dominent la distribution.`
    );
  }
  if (stockCommercialAct < stockPhysiqueAct * 0.1) {
    alertes.push(
      `Alerte invisibilité : Moins de 10% des activités physiques sont visibles sur les plateformes commerciales.`
    );
  }
  if (airbnb > 100) {
    alertes.push(
      `Risque fiscal : ${airbnb} annonces Airbnb détectées. Volume significatif de locations saisonnières.`
    );
  }

  // Diagnostic LLM
  let diagnostic: string;
  try {
    const prompt = `Données de la destination ${destination} :
Hébergements physiques: ${stockPhysiqueHeb} | Airbnb: ${airbnb} | Booking: ${booking} | Abritel: ${abritel}
Activités physiques: ${stockPhysiqueAct} | TripAdvisor: ${tripadvisor} | GetYourGuide: ${getyourguide}
Restauration: TheFork: ${thefork} | Michelin: ${michelin}
Digital Coverage Hébergement: ${digitalCoverageHeb}% | Activités: ${digitalCoverageAct}%

Tâche :
1. Alerte dépendance si Stock Booking > Stock Officiel
2. Alerte invisibilité si activités commerciales < 10% du stock physique
3. Risque fiscal si volume Airbnb important
Ton : Business, factuel, orienté ROI
Sortie JSON : { "diagnostic": "..." }`;

    const result = await trackApiCall({
      auditId,
      apiName: "openai",
      endpoint: "chat/completions",
      call: () =>
        askLLMJson<{ diagnostic: string }>(
          prompt,
          "Agis comme un expert en distribution touristique."
        ),
      estimateCost: () => {
        const tokens = Math.ceil(prompt.length / 4);
        return tokens * API_COSTS.openai.promptTokenCost + 200 * API_COSTS.openai.completionTokenCost;
      },
    });
    diagnostic = result.diagnostic;
  } catch {
    diagnostic = `${destination} : ${stockCommercialHeb} hébergements commercialisés en ligne (Airbnb: ${airbnb}, Booking: ${booking}) pour ${stockPhysiqueHeb} physiques. Digital Coverage: ${digitalCoverageHeb}%.`;
  }

  return {
    hebergement: { airbnb, booking, abritel },
    activites: { tripadvisor, getyourguide },
    restauration: { thefork, michelin },
    digitalCoverage: {
      hebergement: digitalCoverageHeb,
      activites: digitalCoverageAct,
    },
    alertes,
    diagnostic,
  };
}
