import { SchemaDigitalInput, SchemaDigitalOutput } from "@/types/audit";
import { askLLMJson } from "@/lib/llm";
import { googleSerp } from "@/lib/dataforseo";
import { runPageSpeedAudit, getNiveau } from "@/lib/pagespeed";

// ============================================
// MODULE 3 — SCHÉMA DIGITAL
// ============================================

interface ClassificationResult {
  urlOT: string | null;
  urlMairie: string | null;
  classement: Array<{
    url: string;
    titre: string;
    categorie: string;
    position: number;
  }>;
  alertes: string[];
}

/**
 * 3A — Cartographie des acteurs digitaux
 * Deux recherches SERP : marque + intention touristique
 */
async function cartographierActeurs(
  destination: string
): Promise<ClassificationResult> {
  // Lancer les 2 recherches SERP en parallèle
  const [serpMarque, serpTourisme] = await Promise.all([
    googleSerp(`"${destination}"`, 10).catch(() => []),
    googleSerp(`Tourisme ${destination}`, 10).catch(() => []),
  ]);

  const itemsMarque = serpMarque[0]?.items || [];
  const itemsTourisme = serpTourisme[0]?.items || [];

  // Combiner les résultats uniques (marque en priorité)
  const allItems = [...itemsMarque, ...itemsTourisme].filter(
    (item) => item.type === "organic"
  );
  const uniqueUrls = new Map<string, (typeof allItems)[0]>();
  for (const item of allItems) {
    if (!uniqueUrls.has(item.url)) {
      uniqueUrls.set(item.url, item);
    }
  }
  const top10 = Array.from(uniqueUrls.values()).slice(0, 10);

  if (top10.length === 0) {
    return {
      urlOT: null,
      urlMairie: null,
      classement: [],
      alertes: ["Aucun résultat SERP trouvé pour cette destination"],
    };
  }

  // Classification LLM
  try {
    const listForLLM = top10
      .map(
        (item, i) =>
          `${i + 1}. Titre: "${item.title}" | URL: ${item.url} | Description: "${item.description?.slice(0, 100) || ""}"`
      )
      .join("\n");

    const classification = await askLLMJson<{
      urlOT: string | null;
      urlMairie: string | null;
      classement: Array<{
        url: string;
        categorie: string;
        position: number;
      }>;
      alertes: string[];
    }>(
      `Voici les 10 résultats Google trouvés pour la recherche "${destination}" :
${listForLLM}

Tâche :
1. Identifie l'URL du site officiel de l'Office de Tourisme (s'il est présent)
2. Identifie l'URL du site de la Mairie
3. Classe chaque URL dans une catégorie : OFFICIEL_INSTITUTIONNEL (mairie, .gouv.fr) / OFFICIEL_PROMOTION (OT, tourisme) / OTA (Booking, Airbnb, Expedia) / INFO_MEDIA (Wikipedia, presse, blogs)
4. Si Booking/Airbnb/Wikipedia passent AVANT le site officiel OT, génère une alerte "Visibilité cannibalisée par les tiers"
5. Si le site de l'OT est absent du Top 5, génère une alerte "Visibilité critique"
Sortie JSON : { "urlOT": "..." ou null, "urlMairie": "..." ou null, "classement": [{"url": "...", "categorie": "...", "position": N}], "alertes": ["..."] }`,
      "Agis comme un expert SEO."
    );

    return {
      urlOT: classification.urlOT,
      urlMairie: classification.urlMairie,
      classement: classification.classement.map((c) => ({
        ...c,
        titre: top10.find((t) => t.url === c.url)?.title || "",
      })),
      alertes: classification.alertes,
    };
  } catch {
    // Fallback algorithmique
    const urlOT =
      top10.find(
        (item) =>
          item.url.includes("tourisme") || item.url.includes("office-tourisme")
      )?.url || null;
    const urlMairie =
      top10.find(
        (item) =>
          item.domain.includes("mairie") || item.domain.includes(".gouv.fr")
      )?.url || null;

    return {
      urlOT,
      urlMairie,
      classement: top10.map((item, i) => ({
        url: item.url,
        titre: item.title,
        categorie: categorizeDomain(item.domain),
        position: i + 1,
      })),
      alertes: urlOT ? [] : ["URL de l'Office de Tourisme non identifiée"],
    };
  }
}

function categorizeDomain(domain: string): string {
  if (domain.includes("booking")) return "OTA";
  if (domain.includes("airbnb")) return "OTA";
  if (domain.includes("tripadvisor")) return "OTA";
  if (domain.includes("expedia")) return "OTA";
  if (domain.includes("wikipedia")) return "INFO_MEDIA";
  if (domain.includes("mairie") || domain.includes(".gouv.fr"))
    return "OFFICIEL_INSTITUTIONNEL";
  if (domain.includes("tourisme") || domain.includes("office"))
    return "OFFICIEL_PROMOTION";
  return "INFO_MEDIA";
}

/**
 * 3B — Santé Technique (Core Web Vitals)
 */
async function auditerPageSpeed(
  url: string
): Promise<SchemaDigitalOutput["pagespeed"]> {
  try {
    const psi = await runPageSpeedAudit(url, "mobile");
    const niveau = getNiveau(psi.score);

    // Diagnostic LLM
    let diagnostic: string;
    try {
      const result = await askLLMJson<{ diagnostic: string }>(
        `Voici les résultats de l'audit technique mobile du site ${url} :
Score Global : ${psi.score}/100
Vitesse d'affichage (LCP) : ${psi.lcp} secondes
Stabilité visuelle (CLS) : ${psi.cls}
Réactivité (INP) : ${psi.inp}ms

Tâche :
Rédige un diagnostic de 3 phrases orienté Business et Expérience Utilisateur.
Si le score est rouge (<50) : Sois alarmiste. Parle de 'Friction majeure', de 'Perte de chiffre d'affaires' et d'impact négatif sur le référencement Google.
Si le score est orange (50-89) : Encourage l'optimisation des images et le code pour passer un cap.
Si le score est vert (90+) : Félicite la destination pour la qualité de son infrastructure.
Sortie JSON : { "diagnostic": "..." }`,
        "Agis comme un expert technique web (CTO)."
      );
      diagnostic = result.diagnostic;
    } catch {
      diagnostic =
        niveau === "rouge"
          ? `Score critique de ${psi.score}/100. Le site met ${psi.lcp}s à afficher son contenu principal, causant une friction majeure pour les visiteurs mobiles.`
          : niveau === "orange"
            ? `Score moyen de ${psi.score}/100. Des optimisations sont possibles pour améliorer l'expérience mobile.`
            : `Excellent score de ${psi.score}/100. L'infrastructure technique est solide.`;
    }

    return { ...psi, niveau, diagnostic };
  } catch (error) {
    console.warn("[Schéma Digital 3B] PageSpeed échoué:", error);
    return {
      score: 0,
      lcp: 0,
      cls: 0,
      inp: 0,
      niveau: "rouge",
      diagnostic: `Impossible d'auditer ${url}. Le site est peut-être hors ligne ou bloque les robots.`,
    };
  }
}

// ============================================
// ORCHESTRATEUR MODULE 3
// ============================================

export async function runSchemaDigital(
  input: SchemaDigitalInput
): Promise<SchemaDigitalOutput> {
  const { destination } = input;

  // Étape 1 : Cartographie des acteurs
  const acteurs = await cartographierActeurs(destination);

  // Étape 2 : Audit PageSpeed sur le site OT (si trouvé)
  let pagespeed: SchemaDigitalOutput["pagespeed"];
  if (acteurs.urlOT) {
    pagespeed = await auditerPageSpeed(acteurs.urlOT);
  } else {
    pagespeed = {
      score: 0,
      lcp: 0,
      cls: 0,
      inp: 0,
      niveau: "rouge",
      diagnostic:
        "Aucun site officiel d'Office de Tourisme identifié pour l'audit technique.",
    };
  }

  return {
    urlOT: acteurs.urlOT,
    urlMairie: acteurs.urlMairie,
    classementDigital: acteurs.classement.map((c) => ({
      url: c.url,
      categorie: c.categorie,
      position: c.position,
    })),
    alertes: acteurs.alertes,
    pagespeed,
  };
}
