import { BenchmarkInput, BenchmarkOutput } from "@/types/audit";
import { askLLMJson } from "@/lib/llm";
import { loadCommunes, type CommuneData } from "@/lib/communes";
import { duckduckgoSearch } from "@/lib/duckduckgo";
import { googleResultsCount } from "@/lib/dataforseo";
import { trackApiCall } from "@/lib/api-tracker";
import { API_COSTS } from "@/lib/api-costs";

// ============================================
// MODULE 7 — BENCHMARK CONCURRENTIEL
// ============================================

// Départements par typologie géographique
const DEPTS_MONTAGNE = ["73", "74", "38", "05", "65", "31", "66", "04", "06", "64", "09"];
const DEPTS_MER = ["06", "83", "13", "34", "85", "17", "33", "64", "30", "11", "66", "2A", "2B", "29", "22", "56", "44", "50", "14", "76"];

/**
 * A — Profiler la destination
 */
function getTypologieGeo(codeDept: string): string {
  if (DEPTS_MONTAGNE.includes(codeDept)) return "Montagne";
  if (DEPTS_MER.includes(codeDept)) return "Mer";
  return "Campagne/Urbain";
}

/**
 * B — 3 Concurrents Directs (même département, population ±30%)
 */
function findConcurrentsDirects(
  target: CommuneData,
  allCommunes: CommuneData[]
): CommuneData[] {
  const popMin = target.population * 0.7;
  const popMax = target.population * 1.3;

  return allCommunes
    .filter(
      (c) =>
        c.codeDepartement === target.codeDepartement &&
        c.cog !== target.cog &&
        c.population >= popMin &&
        c.population <= popMax
    )
    .sort(
      (a, b) =>
        Math.abs(a.population - target.population) -
        Math.abs(b.population - target.population)
    )
    .slice(0, 3);
}

/**
 * C — 3 Concurrents Indirects (autre département, même typo, population ±20%)
 */
function findConcurrentsIndirects(
  target: CommuneData,
  allCommunes: CommuneData[],
  typologieCible: string
): CommuneData[] {
  const popMin = target.population * 0.8;
  const popMax = target.population * 1.2;

  // Départements de même typologie mais différents
  let deptsCompatibles: string[];
  if (typologieCible === "Montagne") {
    deptsCompatibles = DEPTS_MONTAGNE.filter(
      (d) => d !== target.codeDepartement
    );
  } else if (typologieCible === "Mer") {
    deptsCompatibles = DEPTS_MER.filter(
      (d) => d !== target.codeDepartement
    );
  } else {
    // Campagne/Urbain : tout sauf le même département
    deptsCompatibles = allCommunes
      .map((c) => c.codeDepartement)
      .filter(
        (d) =>
          d !== target.codeDepartement &&
          !DEPTS_MONTAGNE.includes(d) &&
          !DEPTS_MER.includes(d)
      );
  }

  return allCommunes
    .filter(
      (c) =>
        deptsCompatibles.includes(c.codeDepartement) &&
        c.population >= popMin &&
        c.population <= popMax
    )
    .sort(
      (a, b) =>
        Math.abs(a.population - target.population) -
        Math.abs(b.population - target.population)
    )
    .slice(0, 3);
}

/**
 * D — Audit Flash sur un concurrent (scores social + offre)
 */
async function auditFlashCommune(
  nom: string,
  auditId?: string | null
): Promise<{ scoreSocial: number; scoreOffre: number }> {
  const nomNormalized = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  // Score Social : recherche hashtag Instagram via DDG
  let scoreSocial = 0;
  try {
    const ddgResults = await trackApiCall({
      auditId,
      apiName: "duckduckgo",
      endpoint: "search",
      call: () =>
        duckduckgoSearch(
          `site:instagram.com/explore/tags/ "${nomNormalized}"`
        ),
      estimateCost: () => 0,
    });
    scoreSocial = ddgResults.length * 100;
  } catch {
    // Fallback : estimation via DataForSEO
    try {
      scoreSocial = await trackApiCall({
        auditId,
        apiName: "dataforseo",
        endpoint: "google/resultsCount",
        call: () =>
          googleResultsCount(
            `site:instagram.com "${nom}"`
          ),
        estimateCost: () => API_COSTS.dataforseo.resultsCount,
      });
    } catch {
      scoreSocial = 0;
    }
  }

  // Score Offre : Airbnb via DataForSEO
  let scoreOffre = 0;
  try {
    scoreOffre = await trackApiCall({
      auditId,
      apiName: "dataforseo",
      endpoint: "google/resultsCount",
      call: () =>
        googleResultsCount(
          `site:airbnb.fr/rooms "${nom}"`
        ),
      estimateCost: () => API_COSTS.dataforseo.resultsCount,
    });
  } catch {
    scoreOffre = 0;
  }

  return { scoreSocial, scoreOffre };
}

export async function runBenchmark(
  input: BenchmarkInput,
  auditId?: string | null
): Promise<BenchmarkOutput> {
  const { destination, codeInsee, population, departement } = input;

  // Charger les communes
  const allCommunes = await loadCommunes();
  const target = allCommunes.find((c) => c.cog === codeInsee);

  if (!target) {
    throw new Error(
      `Commune non trouvée pour le code INSEE "${codeInsee}".`
    );
  }

  // A — Profiler
  const typologieGeo = getTypologieGeo(departement);

  // B — Concurrents directs
  const concurrentsDirects = findConcurrentsDirects(target, allCommunes);

  // C — Concurrents indirects
  const concurrentsIndirects = findConcurrentsIndirects(
    target,
    allCommunes,
    typologieGeo
  );

  // D — Audit Flash sur chaque concurrent + la cible
  const allConcurrents = [...concurrentsDirects, ...concurrentsIndirects];
  const auditFlashResults = await Promise.all([
    auditFlashCommune(destination, auditId),
    ...allConcurrents.map((c) => auditFlashCommune(c.nom, auditId)),
  ]);

  const targetAudit = auditFlashResults[0];
  const auditFlash = [
    { nom: destination, ...targetAudit },
    ...allConcurrents.map((c, i) => ({
      nom: c.nom,
      ...auditFlashResults[i + 1],
    })),
  ];

  // Classement (algorithmique)
  const sortedBySocial = [...auditFlash].sort(
    (a, b) => b.scoreSocial - a.scoreSocial
  );
  const sortedByOffre = [...auditFlash].sort(
    (a, b) => b.scoreOffre - a.scoreOffre
  );

  const rangSocial =
    sortedBySocial.findIndex((a) => a.nom === destination) + 1;
  const rangOffre =
    sortedByOffre.findIndex((a) => a.nom === destination) + 1;

  let statut: string;
  const avgRang = (rangSocial + rangOffre) / 2;
  if (avgRang <= 1) statut = "Leader";
  else if (avgRang <= 5) statut = "Challenger";
  else statut = "En retard";

  // LLM : Synthèse positionnement
  let positionnement: string;
  let recommandation: string;
  try {
    const prompt = `Destination cible : ${destination} — Position sociale: ${rangSocial}/7, Position offre: ${rangOffre}/7
Concurrents : ${auditFlash.map((a) => `${a.nom} (Social: ${a.scoreSocial}, Offre: ${a.scoreOffre})`).join(", ")}
Rédige une phrase de positionnement percutante pour le rapport.
Sortie JSON : { "positionnement": "...", "recommandation": "..." }`;

    const llmResult = await trackApiCall({
      auditId,
      apiName: "openai",
      endpoint: "chat/completions",
      call: () =>
        askLLMJson<{
          positionnement: string;
          recommandation: string;
        }>(
          prompt,
          "Agis comme un stratège territorial."
        ),
      estimateCost: () =>
        (prompt.length / 4) * API_COSTS.openai.promptTokenCost +
        200 * API_COSTS.openai.completionTokenCost,
    });
    positionnement = llmResult.positionnement;
    recommandation = llmResult.recommandation;
  } catch {
    positionnement = `${destination} se classe ${rangSocial}/7 en visibilité sociale et ${rangOffre}/7 en offre commerciale (${statut}).`;
    recommandation =
      statut === "En retard"
        ? "Investir urgemment dans la visibilité digitale pour rattraper les concurrents."
        : "Maintenir la dynamique et surveiller les concurrents.";
  }

  return {
    profil: { typologieGeo, population, departement },
    concurrentsDirects: concurrentsDirects.map((c) => ({
      nom: c.nom,
      population: c.population,
      departement: c.codeDepartement,
    })),
    concurrentsIndirects: concurrentsIndirects.map((c) => ({
      nom: c.nom,
      population: c.population,
      departement: c.codeDepartement,
    })),
    auditFlash,
    classement: { social: rangSocial, offre: rangOffre, statut },
    positionnement,
    recommandation,
  };
}
