import { supabase } from "./supabase";

export interface TrackApiCallOptions<T> {
  auditId?: string | null;
  apiName: string;
  endpoint?: string;
  call: () => Promise<T>;
  estimateCost?: (result: T) => number;
  tokensUsed?: (result: T) => number;
}

/**
 * Wrapper générique pour tracker chaque appel API.
 * Mesure le temps de réponse, calcule le coût estimé,
 * et enregistre dans Supabase. Ne fait jamais planter l'audit.
 */
export async function trackApiCall<T>({
  auditId,
  apiName,
  endpoint,
  call,
  estimateCost,
  tokensUsed,
}: TrackApiCallOptions<T>): Promise<T> {
  const start = Date.now();
  let status = "success";
  let result: T;

  try {
    result = await call();
  } catch (error) {
    status = "error";
    const responseTime = Date.now() - start;

    // Log l'erreur dans Supabase (silencieux)
    try {
      await supabase.from("api_usage").insert({
        audit_id: auditId || null,
        api_name: apiName,
        endpoint: endpoint || null,
        tokens_used: null,
        cost_euros: 0,
        response_time_ms: responseTime,
        status,
      });
    } catch {
      // Silencieux — ne jamais bloquer l'audit
    }

    throw error;
  }

  const responseTime = Date.now() - start;
  const cost = estimateCost ? estimateCost(result) : 0;
  const tokens = tokensUsed ? tokensUsed(result) : null;

  // Insertion Supabase (silencieuse)
  try {
    await supabase.from("api_usage").insert({
      audit_id: auditId || null,
      api_name: apiName,
      endpoint: endpoint || null,
      tokens_used: tokens,
      cost_euros: cost,
      response_time_ms: responseTime,
      status,
    });
  } catch {
    // Silencieux — ne jamais bloquer l'audit
  }

  return result;
}
