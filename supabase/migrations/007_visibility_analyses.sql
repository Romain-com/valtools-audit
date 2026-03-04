-- Migration 007 — Table visibility_analyses
-- Stockage des analyses de score de visibilité digitale (destination ou lieu touristique)

CREATE TABLE IF NOT EXISTS public.visibility_analyses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT        NOT NULL CHECK (type IN ('destination', 'place')),
  keyword     TEXT        NOT NULL,
  domain      TEXT        NOT NULL,
  commune     TEXT,
  scores      JSONB       NOT NULL DEFAULT '{}',
  resultats   JSONB       NOT NULL DEFAULT '{}',
  headline    TEXT,
  insights    JSONB       NOT NULL DEFAULT '[]',
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_visibility_analyses_created_at
  ON public.visibility_analyses (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_visibility_analyses_keyword
  ON public.visibility_analyses (keyword);

CREATE INDEX IF NOT EXISTS idx_visibility_analyses_created_by
  ON public.visibility_analyses (created_by);

-- ─── Row Level Security ───────────────────────────────────

ALTER TABLE public.visibility_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visibility_select_authenticated"
  ON public.visibility_analyses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "visibility_insert_authenticated"
  ON public.visibility_analyses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "visibility_delete_authenticated"
  ON public.visibility_analyses FOR DELETE
  TO authenticated
  USING (true);
