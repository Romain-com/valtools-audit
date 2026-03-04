-- ============================================================
-- Migration 006 — Table ecosystem_analyses
-- Historique des analyses d'écosystème digital (Vue 1)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ecosystem_analyses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  destination   TEXT        NOT NULL,                          -- nom saisi par l'utilisateur
  sites         JSONB       NOT NULL DEFAULT '[]',             -- tableau EnrichedSite[]
  couts_api     JSONB       NOT NULL DEFAULT '{}',             -- coûts DataForSEO + OpenAI + Haloscan
  created_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index sur destination (recherche par nom) et date (tri historique)
CREATE INDEX IF NOT EXISTS idx_ecosystem_destination ON public.ecosystem_analyses (destination);
CREATE INDEX IF NOT EXISTS idx_ecosystem_created_at  ON public.ecosystem_analyses (created_at DESC);

-- ─── Row Level Security ───────────────────────────────────

ALTER TABLE public.ecosystem_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecosystem_select_authenticated"
  ON public.ecosystem_analyses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ecosystem_insert_authenticated"
  ON public.ecosystem_analyses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "ecosystem_delete_authenticated"
  ON public.ecosystem_analyses FOR DELETE
  TO authenticated
  USING (true);
