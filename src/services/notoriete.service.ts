import { NotorieteInput, NotorieteResult } from "@/types/audit";
import { askLLM, askLLMJson } from "@/lib/llm";
import { googleMapsSearch, googleSerp } from "@/lib/dataforseo";
import { getDestinationDescription } from "@/lib/datatourisme";
import { getInstagramProfile } from "@/lib/rapidapi-instagram";
import { duckduckgoSearch } from "@/lib/duckduckgo";
import { trackApiCall } from "@/lib/api-tracker";
import { API_COSTS } from "@/lib/api-costs";

// ============================================
// MODULE 1 — NOTORIÉTÉ
// ============================================

/**
 * 1A — Positionnement Marketing (Identité Voulue)
 * Source : Datatourisme → fallback DataForSEO SERP
 */
async function analyserPositionnement(
  destination: string,
  auditId?: string | null
): Promise<NotorieteResult["positionnement"]> {
  let description: string | null = null;
  let source: "datatourisme" | "dataforseo_fallback" = "datatourisme";

  // Étape 1 : Datatourisme
  description = await trackApiCall({
    auditId,
    apiName: "datatourisme",
    call: () => getDestinationDescription(destination),
    estimateCost: () => 0,
  });

  // Étape 2 : Fallback DataForSEO SERP
  if (!description) {
    source = "dataforseo_fallback";
    try {
      const serpResults = await trackApiCall({
        auditId,
        apiName: "dataforseo",
        endpoint: "google/serp",
        call: () => googleSerp(`"${destination}" tourisme`, 5),
        estimateCost: () => API_COSTS.dataforseo.serp,
      });
      const items = serpResults[0]?.items || [];
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
      source,
    };
  }

  // Étape 3 : Analyse LLM
  try {
    const prompt = `Analyse le texte de présentation ci-dessous concernant la destination ${destination}.
Texte : "${description}"
Identifie : le positionnement dominant (Nature / Sport / Patrimoine / Mer / Montagne / Urbain), les 2-3 arguments de vente clés, et le ton de communication.
Sortie JSON stricte : { "label": "...", "arguments": ["...", "..."], "ton": "..." }`;

    const llmResult = await trackApiCall({
      auditId,
      apiName: "openai",
      endpoint: "chat/completions",
      call: () =>
        askLLMJson<{ label: string; arguments: string[]; ton: string }>(
          prompt,
          "Rôle : Expert en marketing territorial."
        ),
      estimateCost: () =>
        Math.ceil(prompt.length / 4) * API_COSTS.openai.promptTokenCost +
        200 * API_COSTS.openai.completionTokenCost,
    });

    return { ...llmResult, source };
  } catch (error) {
    console.warn("[Notoriété 1A] LLM échoué:", error);
    return {
      label: "Analyse LLM indisponible",
      arguments: [description.slice(0, 200)],
      ton: "N/A (LLM indisponible)",
      source,
    };
  }
}

/**
 * 1B — E-Réputation (Notes & Avis Google)
 * Source : DataForSEO → Google Maps Search
 */
async function analyserEReputation(
  destination: string,
  codePostal: string,
  auditId?: string | null
): Promise<NotorieteResult["eReputation"]> {
  const query = `Office de Tourisme ${destination} ${codePostal}`;

  try {
    const mapsResults = await trackApiCall({
      auditId,
      apiName: "dataforseo",
      endpoint: "google/maps",
      call: () => googleMapsSearch(query),
      estimateCost: () => API_COSTS.dataforseo.maps,
    });

    const items = mapsResults[0]?.items || [];
    const otItem = items[0];

    if (!otItem || !otItem.rating) {
      return {
        note: null,
        nbAvis: null,
        sentiment: null,
        synthese: `Aucun Office de Tourisme trouvé sur Google Maps pour "${destination}".`,
      };
    }

    const note = otItem.rating.value || 0;
    const nbAvis = otItem.rating.votes_count || otItem.reviews_count || 0;

    // Pas d'avis textuels via Maps Search → pas d'appel OpenAI
    return {
      note,
      nbAvis,
      sentiment: null,
      synthese: "Pas assez d'avis pour l'analyse",
    };
  } catch (error) {
    console.warn("[Notoriété 1B] Erreur e-réputation:", error);
    return {
      note: null,
      nbAvis: null,
      sentiment: null,
      synthese: `Impossible de récupérer les données e-réputation pour "${destination}".`,
    };
  }
}

/**
 * 1C — Visibilité Sociale (Instagram)
 * Source : DuckDuckGo (recherche URL) → OpenAI (identification username) → RapidAPI (profil)
 */
async function analyserVisibiliteSociale(
  destination: string,
  auditId?: string | null
): Promise<NotorieteResult["social"]> {
  let followersOT: number | null = null;
  let volumeHashtag: number | null = null;
  let usernameOT: string | null = null;

  // Étape 1 — Chercher les profils Instagram liés via DuckDuckGo
  let ddgSnippets: string[] = [];
  try {
    const ddgResults = await trackApiCall({
      auditId,
      apiName: "duckduckgo",
      call: () =>
        duckduckgoSearch(`site:instagram.com Office Tourisme ${destination}`),
      estimateCost: () => 0,
    });

    ddgSnippets = ddgResults
      .filter((r) => r.url.includes("instagram.com"))
      .map((r) => `${r.title} — ${r.url} — ${r.snippet}`);
  } catch {
    console.warn("[Notoriété 1C] Recherche DuckDuckGo échouée");
  }

  // Étape 2 — Demander à OpenAI d'identifier le bon username
  if (ddgSnippets.length > 0) {
    try {
      const prompt = `Voici des résultats de recherche Instagram pour l'Office de Tourisme de ${destination} :
${ddgSnippets.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Quel est le username Instagram (sans @) du compte officiel de l'Office de Tourisme ou de la destination ${destination} ?
S'il n'y a pas de compte officiel évident, retourne le compte le plus pertinent lié au tourisme de ${destination}.
Sortie JSON stricte : { "username": "..." }
Si aucun résultat n'est pertinent : { "username": null }`;

      const llmResult = await trackApiCall({
        auditId,
        apiName: "openai",
        endpoint: "chat/completions",
        call: () =>
          askLLMJson<{ username: string | null }>(
            prompt,
            "Rôle : Expert en réseaux sociaux et tourisme."
          ),
        estimateCost: () =>
          Math.ceil(prompt.length / 4) * API_COSTS.openai.promptTokenCost +
          100 * API_COSTS.openai.completionTokenCost,
      });

      usernameOT = llmResult.username || null;
    } catch {
      console.warn("[Notoriété 1C] LLM identification username échouée");
      // Fallback : prendre le premier lien instagram.com trouvé
      for (const snippet of ddgSnippets) {
        const match = snippet.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
        if (match && !["explore", "p", "reel", "stories"].includes(match[1])) {
          usernameOT = match[1];
          break;
        }
      }
    }
  }

  // Étape 3 — Récupérer le profil Instagram via RapidAPI
  if (usernameOT) {
    const profile = await getInstagramProfile(usernameOT, auditId);
    if (profile) {
      followersOT = profile.followerCount;
      volumeHashtag = profile.mediaCount;
    }
  }

  // Étape 4 — Diagnostic algorithmique (basé sur les followers)
  let diagnosticCalcule: string;
  if (followersOT === null) {
    diagnosticCalcule = "Données Instagram indisponibles";
  } else if (followersOT < 1000) {
    diagnosticCalcule = "Destination confidentielle ou déficit d'image";
  } else if (followersOT > 5000) {
    diagnosticCalcule = "Destination connectée";
  } else {
    diagnosticCalcule = "Visibilité sociale modérée";
  }

  // Étape 5 — Calcul Ratio Hype
  let ratioHype: number | null = null;
  if (volumeHashtag !== null && followersOT !== null && followersOT > 0) {
    ratioHype = Math.round((volumeHashtag / followersOT) * 100) / 100;
  }

  // Étape 6 — Phrase finale rapport via OpenAI
  let phraseFinalRapport = diagnosticCalcule;
  try {
    const prompt = `Contexte : Destination ${destination}.
Données :
- Compte Instagram OT : @${usernameOT ?? "non trouvé"}
- Followers OT : ${followersOT ?? "inconnu"} abonnés
- Posts publiés : ${volumeHashtag ?? "inconnu"}
- Diagnostic calculé : ${diagnosticCalcule}
Tâche : Rédige une phrase de diagnostic percutante pour un rapport de conseil destiné à un élu.
Sortie : Une seule phrase, sans JSON.`;

    phraseFinalRapport = await trackApiCall({
      auditId,
      apiName: "openai",
      endpoint: "chat/completions",
      call: () =>
        askLLM(
          prompt,
          "Rôle : Consultant en stratégie digitale territoriale."
        ),
      estimateCost: () =>
        Math.ceil(prompt.length / 4) * API_COSTS.openai.promptTokenCost +
        100 * API_COSTS.openai.completionTokenCost,
    });

    // askLLM retourne du JSON forcé — extraire la phrase si wrappée
    try {
      const parsed = JSON.parse(phraseFinalRapport);
      if (typeof parsed === "object" && parsed !== null) {
        phraseFinalRapport =
          parsed.phrase || parsed.diagnostic || parsed.text || parsed.result ||
          Object.values(parsed)[0] || diagnosticCalcule;
      }
    } catch {
      // Déjà une string brute, c'est OK
    }
  } catch {
    console.warn("[Notoriété 1C] LLM phrase finale échouée");
  }

  return {
    volumeHashtag,
    followersOT,
    ratioHype,
    diagnosticCalcule,
    phraseFinalRapport: String(phraseFinalRapport).trim(),
  };
}

// ============================================
// ORCHESTRATEUR MODULE 1
// ============================================

export async function runNotoriete(
  input: NotorieteInput,
  auditId?: string | null
): Promise<NotorieteResult> {
  const { destination, codePostal } = input;

  const [positionnement, eReputation, social] = await Promise.all([
    analyserPositionnement(destination, auditId),
    analyserEReputation(destination, codePostal, auditId),
    analyserVisibiliteSociale(destination, auditId),
  ]);

  return { positionnement, eReputation, social };
}
