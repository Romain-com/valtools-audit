/**
 * Client Google PageSpeed Insights API (gratuit, pas de clé requise)
 * Audit version MOBILE en priorité (70-80% du trafic touristique)
 */

const PSI_BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export interface PageSpeedResult {
  score: number; // 0-100
  lcp: number; // Largest Contentful Paint (secondes)
  cls: number; // Cumulative Layout Shift
  inp: number; // Interaction to Next Paint (ms)
}

export async function runPageSpeedAudit(
  url: string,
  strategy: "mobile" | "desktop" = "mobile"
): Promise<PageSpeedResult> {
  const params = new URLSearchParams({
    url,
    strategy,
    category: "performance",
  });

  const response = await fetch(`${PSI_BASE}?${params}`, {
    signal: AbortSignal.timeout(30000), // PSI peut être lent
  });

  if (!response.ok) {
    throw new Error(`PageSpeed ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();

  const lighthouse = data.lighthouseResult;
  if (!lighthouse) {
    throw new Error("Pas de résultats Lighthouse");
  }

  const score = Math.round(
    (lighthouse.categories?.performance?.score || 0) * 100
  );

  const audits = lighthouse.audits || {};

  const lcp = parseFloat(
    (audits["largest-contentful-paint"]?.numericValue || 0) / 1000 + ""
  );
  const cls = parseFloat(
    audits["cumulative-layout-shift"]?.numericValue || 0 + ""
  );
  const inp = parseFloat(
    audits["interaction-to-next-paint"]?.numericValue ||
      audits["max-potential-fid"]?.numericValue ||
      0 + ""
  );

  return {
    score: Math.round(score),
    lcp: Math.round(lcp * 100) / 100,
    cls: Math.round(cls * 1000) / 1000,
    inp: Math.round(inp),
  };
}

/**
 * Détermine le niveau de santé technique (algorithmique)
 */
export function getNiveau(score: number): "vert" | "orange" | "rouge" {
  if (score >= 90) return "vert";
  if (score >= 50) return "orange";
  return "rouge";
}
