import { StocksCommerciauxInput, StocksCommerciauxOutput } from "@/types/audit";
import { askLLMJson } from "@/lib/llm";
import { googleResultsCount } from "@/lib/dataforseo";

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
  input: StocksCommerciauxInput
): Promise<StocksCommerciauxOutput> {
  const { destination, stocksPhysiques } = input;

  // Lancer toutes les requêtes de dorking en parallèle
  const [airbnb, booking, abritel, tripadvisor, getyourguide, thefork, michelin] =
    await Promise.all([
      googleResultsCount(DORKING_QUERIES.hebergement.airbnb(destination)).catch(() => 0),
      googleResultsCount(DORKING_QUERIES.hebergement.booking(destination)).catch(() => 0),
      googleResultsCount(DORKING_QUERIES.hebergement.abritel(destination)).catch(() => 0),
      googleResultsCount(DORKING_QUERIES.activites.tripadvisor(destination)).catch(() => 0),
      googleResultsCount(DORKING_QUERIES.activites.getyourguide(destination)).catch(() => 0),
      googleResultsCount(DORKING_QUERIES.restauration.thefork(destination)).catch(() => 0),
      googleResultsCount(DORKING_QUERIES.restauration.michelin(destination)).catch(() => 0),
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
    const result = await askLLMJson<{ diagnostic: string }>(
      `Données de la destination ${destination} :
Hébergements physiques: ${stockPhysiqueHeb} | Airbnb: ${airbnb} | Booking: ${booking} | Abritel: ${abritel}
Activités physiques: ${stockPhysiqueAct} | TripAdvisor: ${tripadvisor} | GetYourGuide: ${getyourguide}
Restauration: TheFork: ${thefork} | Michelin: ${michelin}
Digital Coverage Hébergement: ${digitalCoverageHeb}% | Activités: ${digitalCoverageAct}%

Tâche :
1. Alerte dépendance si Stock Booking > Stock Officiel
2. Alerte invisibilité si activités commerciales < 10% du stock physique
3. Risque fiscal si volume Airbnb important
Ton : Business, factuel, orienté ROI
Sortie JSON : { "diagnostic": "..." }`,
      "Agis comme un expert en distribution touristique."
    );
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
