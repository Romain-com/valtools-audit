-- Migration 009 — Table territoire_analyses
-- Stockage des analyses de territoire (hébergements, POI, taxe de séjour, INSEE)
-- Chaque analyse = un snapshot d'un ensemble de communes analysées

CREATE TABLE IF NOT EXISTS public.territoire_analyses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT        NOT NULL,                              -- Nom de l'analyse (ex: "Savoie Mont Blanc Q1 2026")
  communes    JSONB       NOT NULL DEFAULT '[]',                 -- Liste des communes analysées
  resultats   JSONB       NOT NULL DEFAULT '[]',                 -- Tableau de ResultatCommune (hébergements, POI, taxe, INSEE)
  analyse_gpt TEXT,                                             -- Synthèse GPT (nullable — générée séparément)
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_territoire_analyses_created_at
  ON public.territoire_analyses (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_territoire_analyses_created_by
  ON public.territoire_analyses (created_by);

-- GIN sur JSONB pour recherches éventuelles par commune
CREATE INDEX IF NOT EXISTS idx_territoire_analyses_communes_gin
  ON public.territoire_analyses USING GIN (communes);

-- ─── Row Level Security ───────────────────────────────────

ALTER TABLE public.territoire_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "territoire_select_authenticated"
  ON public.territoire_analyses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "territoire_insert_authenticated"
  ON public.territoire_analyses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "territoire_update_authenticated"
  ON public.territoire_analyses FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "territoire_delete_authenticated"
  ON public.territoire_analyses FOR DELETE
  TO authenticated
  USING (true);
