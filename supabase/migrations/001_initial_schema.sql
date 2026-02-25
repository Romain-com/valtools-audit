-- ============================================================
-- Migration 001 — Schéma initial
-- Projet : Destination Digital Audit
-- Tables : profiles, destinations, audits, competitors
-- ============================================================

-- ─── Types ENUM ─────────────────────────────────────────────

CREATE TYPE statut_audit AS ENUM ('en_cours', 'termine', 'erreur');
CREATE TYPE type_concurrent AS ENUM ('direct', 'indirect');
CREATE TYPE role_utilisateur AS ENUM ('admin', 'collaborateur');

-- ─── Table profiles ─────────────────────────────────────────
-- Extension de auth.users Supabase — créée automatiquement par trigger

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        role_utilisateur NOT NULL DEFAULT 'collaborateur',
  nom         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger : crée automatiquement le profil à la création d'un utilisateur Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'collaborateur')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Table destinations ─────────────────────────────────────
-- 1 ligne par SIREN (contrainte UNIQUE) — jamais de doublon

CREATE TABLE IF NOT EXISTS public.destinations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom               TEXT        NOT NULL,
  siren             TEXT        UNIQUE NOT NULL,
  code_insee        TEXT        NOT NULL,
  code_postal       TEXT,
  code_departement  TEXT,
  code_region       TEXT,
  epci              TEXT,         -- SIREN de l'EPCI (non verrouillé, informatif)
  population        INT,
  slug              TEXT        UNIQUE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Trigger : met à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER destinations_updated_at
  BEFORE UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Table audits ────────────────────────────────────────────
-- 1 audit actif par destination (résultats écrasés si relancé)
-- resultats : un objet JSONB par bloc (voir schema-documentation.md)
-- couts_api : agrégat coûts par bloc et par API

CREATE TABLE IF NOT EXISTS public.audits (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id  UUID          NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  statut          statut_audit  NOT NULL DEFAULT 'en_cours',
  resultats       JSONB         NOT NULL DEFAULT '{}',
  couts_api       JSONB         NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── Table competitors ───────────────────────────────────────
-- Concurrents identifiés lors du Bloc 7 (dénormalisés pour accès rapide)
-- metriques : ResultatPhaseAConcurrents + MetriquesConcurrent (JSONB)

CREATE TABLE IF NOT EXISTS public.competitors (
  id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id    UUID            NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  nom         TEXT            NOT NULL,
  type        type_concurrent NOT NULL DEFAULT 'direct',
  metriques   JSONB           NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
