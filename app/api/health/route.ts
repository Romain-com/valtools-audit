// Route Handler — health check de tous les services requis pour l'audit
// GET /api/health → vérifie en parallèle avec timeout 5s par service
// Services CRITIQUES (bloquants) : microservice_local, supabase, openai, dataforseo
// Services OPTIONNELS (warning) : haloscan, apify

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TIMEOUT_MS = 5000

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ServiceStatus {
  ok: boolean
  critique: boolean
  message: string
}

export interface HealthResponse {
  ok: boolean
  services: {
    microservice_local: ServiceStatus
    supabase: ServiceStatus
    openai: ServiceStatus
    dataforseo: ServiceStatus
    haloscan: ServiceStatus
    apify: ServiceStatus
  }
}

// ─── Utilitaire timeout ───────────────────────────────────────────────────────

function avecTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout ${ms}ms dépassé`)), ms)
    ),
  ])
}

// ─── Handler principal ───────────────────────────────────────────────────────

export async function GET() {
  const [
    resMicroservice,
    resSupabase,
    resOpenAI,
    resDataForSEO,
    resHaloscan,
    resApify,
  ] = await Promise.allSettled([
    checkMicroservice(),
    checkSupabase(),
    checkOpenAI(),
    checkDataForSEO(),
    checkHaloscan(),
    checkApify(),
  ])

  function extraire(
    result: PromiseSettledResult<ServiceStatus>,
    critique: boolean
  ): ServiceStatus {
    if (result.status === 'fulfilled') return result.value
    return {
      ok: false,
      critique,
      message: result.reason instanceof Error ? result.reason.message : 'Erreur inconnue',
    }
  }

  const services = {
    microservice_local: extraire(resMicroservice, true),
    supabase:           extraire(resSupabase, true),
    openai:             extraire(resOpenAI, true),
    dataforseo:         extraire(resDataForSEO, true),
    haloscan:           extraire(resHaloscan, false),
    apify:              extraire(resApify, false),
  }

  // ok global = tous les services critiques sont up
  const ok = Object.values(services).every((s) => !s.critique || s.ok)

  return NextResponse.json({ ok, services } satisfies HealthResponse)
}

// ─── Vérifications individuelles ─────────────────────────────────────────────

async function checkMicroservice(): Promise<ServiceStatus> {
  const baseUrl = process.env.DATA_TOURISME_API_URL || 'http://localhost:3001'
  try {
    const res = await avecTimeout(fetch(`${baseUrl}/health`), TIMEOUT_MS)
    if (res.ok) {
      return { ok: true, critique: true, message: 'OK' }
    }
    return {
      ok: false,
      critique: true,
      message: `Microservice DATA Tourisme non démarré → cd microservice && npm run dev`,
    }
  } catch {
    return {
      ok: false,
      critique: true,
      message: 'Microservice DATA Tourisme non démarré → cd microservice && npm run dev',
    }
  }
}

async function checkSupabase(): Promise<ServiceStatus> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return {
      ok: false,
      critique: true,
      message: 'Supabase inaccessible → vérifier NEXT_PUBLIC_SUPABASE_URL dans .env.local',
    }
  }
  try {
    const supabase = createClient(url, key)
    const { error } = await avecTimeout(
      supabase.from('audits').select('id').limit(1),
      TIMEOUT_MS
    )
    if (error) {
      return {
        ok: false,
        critique: true,
        message: 'Supabase inaccessible → vérifier NEXT_PUBLIC_SUPABASE_URL dans .env.local',
      }
    }
    return { ok: true, critique: true, message: 'OK' }
  } catch {
    return {
      ok: false,
      critique: true,
      message: 'Supabase inaccessible → vérifier NEXT_PUBLIC_SUPABASE_URL dans .env.local',
    }
  }
}

async function checkOpenAI(): Promise<ServiceStatus> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      critique: true,
      message: 'Clé OpenAI invalide → vérifier OPENAI_API_KEY dans .env.local',
    }
  }
  try {
    const res = await avecTimeout(
      fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
      TIMEOUT_MS
    )
    if (res.ok) return { ok: true, critique: true, message: 'OK' }
    if (res.status === 401) {
      return {
        ok: false,
        critique: true,
        message: 'Clé OpenAI invalide → vérifier OPENAI_API_KEY dans .env.local',
      }
    }
    return {
      ok: false,
      critique: true,
      message: `OpenAI HTTP ${res.status} → vérifier OPENAI_API_KEY dans .env.local`,
    }
  } catch {
    return {
      ok: false,
      critique: true,
      message: 'Clé OpenAI invalide → vérifier OPENAI_API_KEY dans .env.local',
    }
  }
}

async function checkDataForSEO(): Promise<ServiceStatus> {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) {
    return {
      ok: false,
      critique: true,
      message: 'Auth DataForSEO échouée → vérifier DATAFORSEO_LOGIN et PASSWORD dans .env.local',
    }
  }
  try {
    const credentials = Buffer.from(`${login}:${password}`).toString('base64')
    const res = await avecTimeout(
      fetch('https://api.dataforseo.com/v3/appendix/user_data', {
        headers: { Authorization: `Basic ${credentials}` },
      }),
      TIMEOUT_MS
    )
    if (res.ok) return { ok: true, critique: true, message: 'OK' }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        critique: true,
        message: 'Auth DataForSEO échouée → vérifier DATAFORSEO_LOGIN et PASSWORD dans .env.local',
      }
    }
    return {
      ok: false,
      critique: true,
      message: `DataForSEO HTTP ${res.status} → vérifier DATAFORSEO_LOGIN et PASSWORD dans .env.local`,
    }
  } catch {
    return {
      ok: false,
      critique: true,
      message: 'Auth DataForSEO échouée → vérifier DATAFORSEO_LOGIN et PASSWORD dans .env.local',
    }
  }
}

async function checkHaloscan(): Promise<ServiceStatus> {
  const apiKey = process.env.HALOSCAN_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      critique: false,
      message: 'Haloscan indisponible → Blocs 3, 4 et 7 seront dégradés',
    }
  }
  try {
    const res = await avecTimeout(
      fetch('https://api.haloscan.com/api/domains/overview', {
        method: 'POST',
        headers: {
          'haloscan-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        // Ping avec un domaine connu pour éviter de consommer un crédit
        body: JSON.stringify({ input: 'ping.check', mode: 'domain', requested_data: ['metrics'] }),
      }),
      TIMEOUT_MS
    )
    // 200, 404 (SITE_NOT_FOUND), 422 = API joignable
    if (res.ok || res.status === 404 || res.status === 422) {
      return { ok: true, critique: false, message: 'OK' }
    }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        critique: false,
        message: 'Haloscan indisponible → Blocs 3, 4 et 7 seront dégradés',
      }
    }
    // 5xx = API joignable mais dégradée → on considère OK pour ne pas bloquer
    return { ok: true, critique: false, message: `OK (HTTP ${res.status})` }
  } catch {
    return {
      ok: false,
      critique: false,
      message: 'Haloscan indisponible → Blocs 3, 4 et 7 seront dégradés',
    }
  }
}

async function checkApify(): Promise<ServiceStatus> {
  const token = process.env.APIFY_API_TOKEN
  if (!token) {
    return {
      ok: false,
      critique: false,
      message: 'Apify indisponible → Instagram (Bloc 1) sera absent',
    }
  }
  try {
    const res = await avecTimeout(
      fetch(`https://api.apify.com/v2/users/me?token=${token}`),
      TIMEOUT_MS
    )
    if (res.ok) return { ok: true, critique: false, message: 'OK' }
    return {
      ok: false,
      critique: false,
      message: 'Apify indisponible → Instagram (Bloc 1) sera absent',
    }
  } catch {
    return {
      ok: false,
      critique: false,
      message: 'Apify indisponible → Instagram (Bloc 1) sera absent',
    }
  }
}
