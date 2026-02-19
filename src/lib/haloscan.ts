const HALOSCAN_BASE = "https://api.haloscan.com/v1";

function getAuthHeader(): string {
  return `Bearer ${process.env.HALOSCAN_JWT}`;
}

interface KeywordVolumeResult {
  keyword: string;
  volume: number;
  cpc?: number;
  competition?: number;
}

/**
 * Récupère le volume de recherche mensuel pour une liste de mots-clés
 * via HaloScan (alternative à Semrush)
 */
export async function getKeywordVolumes(
  keywords: string[],
  locationCode: number = 2250 // France
): Promise<KeywordVolumeResult[]> {
  try {
    const response = await fetch(`${HALOSCAN_BASE}/keyword_volume`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keywords,
        location_code: locationCode,
        language_code: "fr",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HaloScan ${response.status}: ${text}`);
    }

    const data = await response.json();
    return data.results || data || [];
  } catch (error) {
    console.warn("[HaloScan] Erreur:", error);
    // Retourner des résultats vides plutôt que crasher
    return keywords.map((kw) => ({ keyword: kw, volume: 0 }));
  }
}
