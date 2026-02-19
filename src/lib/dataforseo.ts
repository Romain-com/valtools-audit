const DATAFORSEO_BASE = "https://api.dataforseo.com/v3";

function getAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN!;
  const password = process.env.DATAFORSEO_PASSWORD!;
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

interface DataForSEOResponse<T> {
  version: string;
  status_code: number;
  status_message: string;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    result: T[];
  }>;
}

async function dataForSeoPost<T>(
  endpoint: string,
  body: unknown[]
): Promise<T[]> {
  const response = await fetch(`${DATAFORSEO_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DataForSEO ${response.status}: ${text}`);
  }

  const data: DataForSEOResponse<T> = await response.json();

  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO error: ${data.status_message}`);
  }

  const task = data.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(
      `DataForSEO task error: ${task?.status_message || "no task"}`
    );
  }

  return task.result || [];
}

// ---- Google Maps Search (Module 1B — E-Réputation) ----

export interface MapsSearchResult {
  items: Array<{
    title: string;
    rating?: { value: number; votes_count: number };
    reviews_count?: number;
    url?: string;
    address?: string;
  }>;
}

export async function googleMapsSearch(
  query: string
): Promise<MapsSearchResult[]> {
  return dataForSeoPost<MapsSearchResult>(
    "/serp/google/maps/live/advanced",
    [
      {
        keyword: query,
        location_code: 2250, // France
        language_code: "fr",
        device: "desktop",
        depth: 5,
      },
    ]
  );
}

// ---- Google Reviews (Module 1B) ----

export interface ReviewsResult {
  reviews_count: number;
  rating: { value: number };
  items: Array<{
    review_text: string;
    rating: { value: number };
    time_ago: string;
  }>;
}

export async function googleReviews(
  keyword: string
): Promise<ReviewsResult[]> {
  return dataForSeoPost<ReviewsResult>(
    "/business_data/google/reviews/live",
    [
      {
        keyword,
        location_code: 2250,
        language_code: "fr",
        depth: 10,
      },
    ]
  );
}

// ---- Google SERP Organique (Modules 3, 4, 6) ----

export interface SerpOrganicResult {
  items: Array<{
    type: string;
    rank_group: number;
    rank_absolute: number;
    title: string;
    url: string;
    description: string;
    domain: string;
  }>;
  spell?: { keyword: string };
  item_types: string[];
  se_results_count: number;
}

export async function googleSerp(
  keyword: string,
  depth: number = 10
): Promise<SerpOrganicResult[]> {
  return dataForSeoPost<SerpOrganicResult>(
    "/serp/google/organic/live/advanced",
    [
      {
        keyword,
        location_code: 2250,
        language_code: "fr",
        device: "desktop",
        depth,
      },
    ]
  );
}

// ---- Google SERP avec People Also Ask (Module 4) ----

export async function googleSerpWithPAA(
  keyword: string
): Promise<SerpOrganicResult[]> {
  return dataForSeoPost<SerpOrganicResult>(
    "/serp/google/organic/live/advanced",
    [
      {
        keyword,
        location_code: 2250,
        language_code: "fr",
        device: "desktop",
        depth: 10,
      },
    ]
  );
}

// ---- Comptage résultats Google (Module 6 — Dorking) ----

export async function googleResultsCount(
  query: string
): Promise<number> {
  const results = await googleSerp(query, 1);
  return results[0]?.se_results_count || 0;
}
