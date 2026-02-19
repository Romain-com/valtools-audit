import { ApifyClient } from "apify-client";

const HASHTAG_SCRAPER_ACTOR = "shu8hvrXbJbY3Eb9W";

function getClient(): ApifyClient {
  return new ApifyClient({ token: process.env.APIFY_API_KEY });
}

interface HashtagResult {
  mediaCount?: number;
  name?: string;
  id?: string;
  topPosts?: Array<{
    likesCount?: number;
    commentsCount?: number;
  }>;
}

/**
 * Scrape le volume d'un hashtag Instagram via Apify
 * Retourne le nombre de posts utilisant ce hashtag
 */
export async function scrapeHashtagVolume(
  hashtag: string
): Promise<number> {
  try {
    const client = getClient();

    const cleanTag = hashtag.replace("#", "");
    const run = await client.actor(HASHTAG_SCRAPER_ACTOR).call(
      {
        addParentData: false,
        directUrls: [`https://www.instagram.com/explore/tags/${cleanTag}/`],
        resultsLimit: 1,
        resultsType: "mentions",
        searchLimit: 1,
        searchType: "hashtag",
      },
      { timeout: 60 }
    );

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems();

    if (items.length > 0) {
      const result = items[0] as HashtagResult;
      return result.mediaCount || 0;
    }

    return 0;
  } catch (error) {
    console.warn("[Apify] Erreur scraping hashtag:", error);
    return 0;
  }
}

/**
 * Estime le nombre de followers d'un compte Instagram
 * via recherche Google (fallback si Apify échoue)
 */
export async function estimateFollowersFromGoogle(
  instagramUrl: string
): Promise<number> {
  // On utilise DataForSEO pour chercher le profil Instagram
  // et extraire le nombre de followers du snippet Google
  try {
    const { googleSerp } = await import("./dataforseo");
    const results = await googleSerp(`site:instagram.com "${instagramUrl}"`, 1);
    const firstResult = results[0]?.items?.[0];

    if (firstResult?.description) {
      // Les snippets Instagram dans Google montrent souvent "X Followers"
      const match = firstResult.description.match(
        /([\d,.]+[KkMm]?)\s*(?:Followers|abonnés|follower)/i
      );
      if (match) {
        return parseFollowerCount(match[1]);
      }
    }

    return 0;
  } catch {
    return 0;
  }
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
