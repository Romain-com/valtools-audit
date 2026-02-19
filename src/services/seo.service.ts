import { AuditSeoInput, AuditSeoOutput } from "@/types/audit";
import { askLLMJson } from "@/lib/llm";
import { googleSerp, googleSerpWithPAA } from "@/lib/dataforseo";
import { getKeywordVolumes } from "@/lib/haloscan";
import { trackApiCall } from "@/lib/api-tracker";
import { API_COSTS } from "@/lib/api-costs";

// ============================================
// MODULE 4 — AUDIT SEO
// ============================================

/**
 * Construction du noyau sémantique (algorithmique)
 */
function buildNoyauSemantique(
  destination: string
): Array<{ kw: string; categorie: string }> {
  return [
    // Marque
    { kw: destination, categorie: "Marque" },
    { kw: `Office de tourisme ${destination}`, categorie: "Marque" },
    // Hébergement
    { kw: `Hôtel ${destination}`, categorie: "Hébergement" },
    { kw: `Camping ${destination}`, categorie: "Hébergement" },
    { kw: `Gîte ${destination}`, categorie: "Hébergement" },
    { kw: `Location ${destination}`, categorie: "Hébergement" },
    // Activités
    { kw: `Que faire à ${destination}`, categorie: "Activités" },
    { kw: `Randonnée ${destination}`, categorie: "Activités" },
    { kw: `Restaurant ${destination}`, categorie: "Activités" },
  ];
}

/**
 * Détermine le statut de visibilité de l'OT dans les SERP
 */
function getVisibiliteStatut(position: number | null): string {
  if (position === null) return "Invisible";
  if (position <= 3) return "Dominant";
  if (position <= 10) return "Challenger";
  return "Invisible";
}

export async function runAuditSeo(
  input: AuditSeoInput,
  auditId?: string | null
): Promise<AuditSeoOutput> {
  const { destination, urlOT } = input;
  const urlOTDomain = urlOT ? new URL(urlOT).hostname : null;

  // Étape A : Construction du noyau sémantique
  const noyau = buildNoyauSemantique(destination);
  const keywords = noyau.map((n) => n.kw);

  // Étape B : Volumes de recherche via HaloScan
  const volumes = await trackApiCall({
    auditId,
    apiName: "haloscan",
    endpoint: "keyword_volume",
    call: () => getKeywordVolumes(keywords),
    estimateCost: () => keywords.length * API_COSTS.haloscan.perKeyword,
  });
  const motsCles: AuditSeoOutput["motsCles"] = noyau.map((n, i) => ({
    kw: n.kw,
    volume: volumes[i]?.volume || 0,
    categorie: n.categorie,
  }));

  // Trier par volume décroissant
  motsCles.sort((a, b) => b.volume - a.volume);

  // Étape C : Top 3 mots-clés business → SERP pour vérifier position OT
  const top3Business = motsCles
    .filter((m) => m.categorie !== "Marque")
    .slice(0, 3);

  const visibiliteOT: AuditSeoOutput["visibiliteOT"] = [];

  for (const mc of top3Business) {
    try {
      const serpResults = await trackApiCall({
        auditId,
        apiName: "dataforseo",
        endpoint: "google/serp",
        call: () => googleSerp(mc.kw, 10),
        estimateCost: () => API_COSTS.dataforseo.serp,
      });
      const items = serpResults[0]?.items || [];
      const otPosition = urlOTDomain
        ? items.find((item) => item.domain?.includes(urlOTDomain))
            ?.rank_group || null
        : null;

      visibiliteOT.push({
        requete: mc.kw,
        position: otPosition,
        statut: getVisibiliteStatut(otPosition),
      });
    } catch {
      visibiliteOT.push({
        requete: mc.kw,
        position: null,
        statut: "Erreur SERP",
      });
    }
  }

  // Étape D : People Also Ask via DataForSEO
  let paa: string[] = [];
  try {
    const serpPAA = await trackApiCall({
      auditId,
      apiName: "dataforseo",
      endpoint: "google/serp/paa",
      call: () => googleSerpWithPAA(`Visiter ${destination}`),
      estimateCost: () => API_COSTS.dataforseo.serp,
    });
    const items = serpPAA[0]?.items || [];
    paa = items
      .filter((item) => item.type === "people_also_ask")
      .flatMap((item) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const paaItem = item as any;
        if (paaItem.items) {
          return paaItem.items.map(
            (q: { title?: string }) => q.title || ""
          );
        }
        return [paaItem.title || ""];
      })
      .filter(Boolean)
      .slice(0, 5);
  } catch {
    console.warn("[SEO] PAA non récupérables");
  }

  // Étape E : Synthèse stratégique LLM
  let synthese: AuditSeoOutput["synthese"];
  try {
    const prompt = `Voici les données d'audit SEO pour la destination ${destination}.
TOP 3 Mots-clés Business (Volume/Mois) :
${top3Business.map((m) => `- "${m.kw}" : ${m.volume} recherches/mois`).join("\n")}

Présence de l'Office de Tourisme dans le Top 10 Google :
${visibiliteOT.map((v) => `- Sur la requête "${v.requete}" : ${v.position ? `Position ${v.position} (${v.statut})` : "Absent du Top 10"}`).join("\n")}

Questions fréquentes (PAA) :
${paa.length > 0 ? paa.map((q) => `- "${q}"`).join("\n") : "Aucune PAA récupérée"}

Tâche :
Rédige une synthèse de 3 points :
- Opportunité Manquée : Si le volume est fort sur 'Hôtel' mais que l'OT est absent du Top 10, dis-le clairement.
- Intention Dominante : Les gens cherchent-ils plutôt du luxe, du camping ou des activités ?
- Réponse aux PAA : Si les questions concernent le parking ou la météo, suggère de créer une page dédiée.
Sortie JSON : { "opportunite": "...", "intention": "...", "paaRecommendation": "..." }`;

    synthese = await trackApiCall({
      auditId,
      apiName: "openai",
      endpoint: "chat/completions",
      call: () =>
        askLLMJson<AuditSeoOutput["synthese"]>(
          prompt,
          "Agis comme un consultant SEO Stratégique."
        ),
      estimateCost: () =>
        Math.ceil(prompt.length / 4) * API_COSTS.openai.promptTokenCost +
        200 * API_COSTS.openai.completionTokenCost,
    });
  } catch {
    synthese = {
      opportunite:
        visibiliteOT.some((v) => v.statut === "Invisible")
          ? `L'OT est absent du Top 10 sur des requêtes business clés.`
          : `L'OT a une présence correcte sur les requêtes business.`,
      intention: top3Business[0]
        ? `La requête dominante est "${top3Business[0].kw}".`
        : "Données insuffisantes.",
      paaRecommendation:
        paa.length > 0
          ? `Les internautes posent des questions comme "${paa[0]}". Créez du contenu pour y répondre.`
          : "Aucune PAA détectée.",
    };
  }

  return {
    motsCles,
    visibiliteOT,
    paa,
    synthese,
  };
}
