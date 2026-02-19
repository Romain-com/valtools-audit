/**
 * Client DuckDuckGo — fallback pour les recherches web
 * Utilisé quand DataForSEO ou Apify ne sont pas disponibles.
 */

interface DDGResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Recherche DuckDuckGo via le HTML lite (pas d'API key requise)
 */
export async function duckduckgoSearch(
  query: string
): Promise<DDGResult[]> {
  try {
    const response = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      body: `q=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(10000),
    });

    const html = await response.text();
    return parseResults(html);
  } catch (error) {
    console.warn("[DuckDuckGo] Erreur:", error);
    return [];
  }
}

function parseResults(html: string): DDGResult[] {
  const results: DDGResult[] = [];

  // Pattern pour les résultats DDG Lite
  const resultRegex =
    /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRegex =
    /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  const links = [...html.matchAll(resultRegex)];
  const snippets = [...html.matchAll(snippetRegex)];

  for (let i = 0; i < Math.min(links.length, 10); i++) {
    const url = links[i]?.[1] || "";
    const title = (links[i]?.[2] || "").replace(/<[^>]*>/g, "").trim();
    const snippet = (snippets[i]?.[1] || "").replace(/<[^>]*>/g, "").trim();

    if (url && title) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

/**
 * Estime le nombre de résultats pour une requête (via nombre de pages)
 * Utilisé comme fallback pour les volumes hashtag Instagram
 */
export async function estimateResultsCount(query: string): Promise<number> {
  const results = await duckduckgoSearch(query);
  // DuckDuckGo ne fournit pas de compteur total
  // On retourne le nombre de résultats trouvés comme indicateur
  return results.length;
}
