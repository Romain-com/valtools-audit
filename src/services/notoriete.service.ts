import { NotorieteInput, NotorieteOutput } from "@/types/audit";
import { askLLMJson } from "@/lib/llm";
import { googleMapsSearch, googleSerp } from "@/lib/dataforseo";
import { getDestinationDescription } from "@/lib/datatourisme";
import { scrapeHashtagVolume } from "@/lib/apify-instagram";
import { duckduckgoSearch } from "@/lib/duckduckgo";

// ============================================
// MODULE 1 — NOTORIÉTÉ
// ============================================

/**
 * 1A — Positionnement Marketing (Identité Voulue)
 * Source : Datatourisme → fallback DataForSEO SERP
 */
async function analyserPositionnement(
  destination: string
): Promise<NotorieteOutput["positionnement"]> {
  // Étape 1 : Chercher la description via Datatourisme
  let description = await getDestinationDescription(destination);

  // Étape 2 : Fallback → DataForSEO SERP pour la meta description du site officiel
  if (!description) {
    try {
      const serpResults = await googleSerp(`"${destination}" tourisme site officiel`, 5);
      const items = serpResults[0]?.items || [];
      // Chercher un résultat qui ressemble au site OT
      const otResult = items.find(
        (item) =>
          item.description &&
          item.description.length > 50 &&
          (item.url.includes("tourisme") ||
            item.url.includes("office") ||
            item.domain.includes(".fr"))
      );
      description = otResult?.description || items[0]?.description || null;
    } catch (error) {
      console.warn("[Notoriété 1A] Fallback SERP échoué:", error);
    }
  }

  if (!description) {
    return {
      label: "Non déterminé",
      arguments: ["Aucune description trouvée pour cette destination"],
      ton: "N/A",
    };
  }

  // Étape 3 : Analyse LLM
  try {
    return await askLLMJson<NotorieteOutput["positionnement"]>(
      `Analyse le texte de présentation ci-dessous concernant ${destination}.
Texte : "${description}"
Identifie en 2-3 phrases : le positionnement dominant (Nature / Sport / Patrimoine / Mer / Montagne / Urbain), les arguments de vente clés, et le ton de communication.
Sortie JSON : { "label": "...", "arguments": ["...", "..."], "ton": "..." }`,
      "Rôle : Expert en marketing territorial."
    );
  } catch (error) {
    console.warn("[Notoriété 1A] LLM échoué, retour description brute:", error);
    return {
      label: "Analyse LLM indisponible",
      arguments: [description.slice(0, 200)],
      ton: "N/A (LLM indisponible)",
    };
  }
}

/**
 * 1B — E-Réputation (Notes & Avis Google)
 * Source : DataForSEO → Google Maps
 */
async function analyserEReputation(
  destination: string,
  codePostal: string
): Promise<NotorieteOutput["eReputation"]> {
  const query = `Office de Tourisme ${destination} ${codePostal}`;

  try {
    // Récupérer les infos Google Maps
    const mapsResults = await googleMapsSearch(query);
    const items = mapsResults[0]?.items || [];
    const otItem = items[0]; // Premier résultat = le plus pertinent

    if (!otItem || !otItem.rating) {
      return {
        note: 0,
        nbAvis: 0,
        sentiment: 0,
        synthese: `Aucun Office de Tourisme trouvé sur Google Maps pour "${destination}".`,
      };
    }

    const note = otItem.rating.value || 0;
    const nbAvis = otItem.rating.votes_count || otItem.reviews_count || 0;

    // Récupérer les avis textuels si disponibles
    let avisTextes: string[] = [];
    try {
      const { googleReviews } = await import("@/lib/dataforseo");
      const reviewsData = await googleReviews(query);
      const reviews = reviewsData[0]?.items || [];
      avisTextes = reviews
        .slice(0, 5)
        .map((r) => r.review_text)
        .filter(Boolean);
    } catch {
      // Pas de reviews textuelles, on continue sans
    }

    // Analyse de sentiment LLM (si on a des avis)
    if (avisTextes.length > 0) {
      try {
        const sentimentResult = await askLLMJson<{
          synthese: string;
          sentiment_score: number;
        }>(
          `Contexte : Voici les derniers avis laissés sur l'Office de Tourisme de ${destination}.
Avis :
${avisTextes.map((a, i) => `${i + 1}. "${a}"`).join("\n")}
Tâche : Synthétise l'opinion générale en 1 phrase et donne un score de sentiment de -1 (Haine) à +1 (Amour).
Sortie JSON : { "synthese": "...", "sentiment_score": 0.X }`,
          "Rôle : Analyste satisfaction client."
        );

        return {
          note,
          nbAvis,
          sentiment: sentimentResult.sentiment_score,
          synthese: sentimentResult.synthese,
        };
      } catch {
        console.warn("[Notoriété 1B] LLM sentiment échoué, fallback algorithmique");
      }
    }

    return {
      note,
      nbAvis,
      sentiment: note >= 4 ? 0.5 : note >= 3 ? 0 : -0.5,
      synthese: `Note Google : ${note}/5 basée sur ${nbAvis} avis.`,
    };
  } catch (error) {
    console.warn("[Notoriété 1B] Erreur e-réputation:", error);
    return {
      note: 0,
      nbAvis: 0,
      sentiment: 0,
      synthese: `Impossible de récupérer les données e-réputation pour "${destination}".`,
    };
  }
}

/**
 * 1C — Visibilité Sociale (Instagram)
 * Source : Apify (principal) → DuckDuckGo (fallback)
 */
async function analyserVisibiliteSociale(
  destination: string
): Promise<NotorieteOutput["social"]> {
  const hashtagName = destination
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  // Étape 1 : Volume Hashtag via Apify (principal)
  let volumeHashtag = 0;
  try {
    volumeHashtag = await scrapeHashtagVolume(hashtagName);
  } catch {
    console.warn("[Notoriété 1C] Apify échoué, fallback DuckDuckGo");
  }

  // Fallback DuckDuckGo si Apify retourne 0
  if (volumeHashtag === 0) {
    try {
      const ddgResults = await duckduckgoSearch(
        `site:instagram.com/explore/tags/ "${hashtagName}"`
      );
      // Estimation basique : si on trouve des résultats, la destination a une présence
      volumeHashtag = ddgResults.length > 0 ? ddgResults.length * 100 : 0;
    } catch {
      // Continue avec 0
    }
  }

  // Étape 2 : Rechercher le compte Instagram OT
  let followersOT = 0;
  try {
    const serpResults = await googleSerp(
      `Instagram Office de Tourisme ${destination}`,
      5
    );
    const items = serpResults[0]?.items || [];
    const instagramResult = items.find((item) =>
      item.url.includes("instagram.com")
    );

    if (instagramResult) {
      // Extraire le nombre de followers du snippet Google
      const descr = instagramResult.description || "";
      const match = descr.match(
        /([\d,.]+[KkMm]?)\s*(?:Followers|abonnés|follower)/i
      );
      if (match) {
        followersOT = parseFollowerCount(match[1]);
      }
    }
  } catch {
    console.warn("[Notoriété 1C] Recherche followers OT échouée");
  }

  // Étape 3 : Calcul Ratio Hype
  const ratioHype =
    followersOT > 0 ? Math.round((volumeHashtag / followersOT) * 100) / 100 : 0;

  // Étape 4 : Diagnostic algorithmique
  let diagnostic: string;
  if (volumeHashtag < 1000) {
    diagnostic = "Destination confidentielle ou déficit d'image";
  } else if (volumeHashtag > 5000 && followersOT < 1000) {
    diagnostic = "Potentiel viral inexploité par l'OT";
  } else if (volumeHashtag > 5000 && followersOT > 1000) {
    diagnostic = "Destination connectée";
  } else if (ratioHype > 100) {
    diagnostic =
      "La destination est virale (les visiteurs postent bien plus que l'OT)";
  } else if (ratioHype < 1 && ratioHype > 0) {
    diagnostic = "Destination socialement inactive";
  } else {
    diagnostic = "Visibilité sociale modérée";
  }

  return {
    volumeHashtag,
    followersOT,
    ratioHype,
    diagnostic,
  };
}

function parseFollowerCount(raw: string): number {
  const cleaned = raw.replace(/,/g, "").replace(/\s/g, "");
  const multiplierMatch = cleaned.match(/^([\d.]+)([KkMm])$/);
  if (multiplierMatch) {
    const num = parseFloat(multiplierMatch[1]);
    const unit = multiplierMatch[2].toUpperCase();
    if (unit === "K") return Math.round(num * 1_000);
    if (unit === "M") return Math.round(num * 1_000_000);
  }
  return parseInt(cleaned, 10) || 0;
}

// ============================================
// ORCHESTRATEUR MODULE 1
// ============================================

export async function runNotoriete(
  input: NotorieteInput
): Promise<NotorieteOutput> {
  const { destination, codePostal } = input;

  // Exécution parallèle des 3 sous-modules
  const [positionnement, eReputation, social] = await Promise.all([
    analyserPositionnement(destination),
    analyserEReputation(destination, codePostal),
    analyserVisibiliteSociale(destination),
  ]);

  return {
    positionnement,
    eReputation,
    social,
  };
}
