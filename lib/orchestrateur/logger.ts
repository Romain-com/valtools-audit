// Logger structuré → table Supabase audit_logs
// Responsabilité : persister les événements d'audit sans bloquer le flux principal

import { createClient } from '@supabase/supabase-js'

// ─── Client Supabase service role ────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes')
  }

  return createClient(url, key)
}

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Insère un log dans la table audit_logs.
 * Fire-and-forget — ne bloque jamais le flux principal.
 */
export async function log(
  auditId: string,
  niveau: 'info' | 'warning' | 'error',
  message: string,
  bloc?: string,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getSupabase()

    await supabase.from('audit_logs').insert({
      audit_id: auditId,
      bloc: bloc ?? null,
      niveau,
      message,
      detail: detail ?? null,
    })
  } catch (err) {
    // Fallback silencieux — le logging ne doit jamais faire planter l'audit
    console.error('[logger] Erreur insertion audit_log :', err)
  }
}

// ─── Raccourcis ───────────────────────────────────────────────────────────────

export const logInfo = (
  auditId: string,
  message: string,
  bloc?: string,
  detail?: Record<string, unknown>
) => log(auditId, 'info', message, bloc, detail)

export const logWarning = (
  auditId: string,
  message: string,
  bloc?: string,
  detail?: Record<string, unknown>
) => log(auditId, 'warning', message, bloc, detail)

export const logError = (
  auditId: string,
  message: string,
  bloc?: string,
  detail?: Record<string, unknown>
) => log(auditId, 'error', message, bloc, detail)
