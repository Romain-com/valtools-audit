import { trackApiCall } from "./api-tracker";

const RAPIDAPI_HOST =
  "instagram-api-fast-reliable-data-scraper.p.rapidapi.com";

function getHeaders(): Record<string, string> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY manquante");
  return {
    "x-rapidapi-key": key,
    "x-rapidapi-host": RAPIDAPI_HOST,
  };
}

export interface InstagramProfile {
  username: string;
  fullName: string;
  followerCount: number;
  mediaCount: number;
  category: string | null;
  biography: string | null;
  isVerified: boolean;
}

/**
 * Récupère le profil complet d'un compte Instagram via RapidAPI.
 * Retourne null si le compte n'existe pas ou en cas d'erreur.
 */
export async function getInstagramProfile(
  username: string,
  auditId?: string | null
): Promise<InstagramProfile | null> {
  try {
    const cleanUsername = username.replace("@", "").trim();
    return await trackApiCall({
      auditId,
      apiName: "rapidapi_instagram",
      endpoint: "profile",
      call: async () => {
        const url = `https://${RAPIDAPI_HOST}/profile?username=${encodeURIComponent(cleanUsername)}`;
        const response = await fetch(url, {
          method: "GET",
          headers: getHeaders(),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.username) return null;
        return {
          username: data.username,
          fullName: data.full_name || "",
          followerCount: data.follower_count ?? 0,
          mediaCount: data.media_count ?? 0,
          category: data.category || null,
          biography: data.biography || null,
          isVerified: data.is_verified ?? false,
        };
      },
      estimateCost: () => 0.005,
    });
  } catch (error) {
    console.warn("[RapidAPI Instagram] Erreur profile:", error);
    return null;
  }
}
