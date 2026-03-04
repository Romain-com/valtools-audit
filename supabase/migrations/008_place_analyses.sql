-- Migration 008 — Table place_analyses
-- Historique des analyses de lieux touristiques (Vue 2)

CREATE TABLE IF NOT EXISTS public.place_analyses (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  place_name              TEXT        NOT NULL,                    -- nom du lieu saisi
  commune                 TEXT        NOT NULL,                    -- commune de rattachement
  place_domain            TEXT,                                    -- domaine officiel du lieu (null si absent)
  commune_domain          TEXT,                                    -- domaine de la commune / OT
  place_exists            BOOLEAN     NOT NULL DEFAULT false,      -- présence digitale détectée
  commune_mentions_place  BOOLEAN     NOT NULL DEFAULT false,      -- la commune valorise le lieu
  place_visibility        TEXT,                                    -- SUPERIEURE / EQUIVALENTE / INFERIEURE / INEXISTANTE
  score_total             INTEGER,                                 -- score /100 si calculé
  resultats               JSONB       NOT NULL DEFAULT '{}',       -- PlaceData complet
  headline                TEXT,
  recommendations         JSONB       NOT NULL DEFAULT '[]',       -- string[]
  created_by              UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index sur le nom du lieu, la commune et la date
CREATE INDEX IF NOT EXISTS idx_place_analyses_place_name  ON public.place_analyses (place_name);
CREATE INDEX IF NOT EXISTS idx_place_analyses_commune     ON public.place_analyses (commune);
CREATE INDEX IF NOT EXISTS idx_place_analyses_created_at  ON public.place_analyses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_place_analyses_created_by  ON public.place_analyses (created_by);

-- ─── Row Level Security ───────────────────────────────────

ALTER TABLE public.place_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_select_authenticated"
  ON public.place_analyses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "place_insert_authenticated"
  ON public.place_analyses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "place_delete_authenticated"
  ON public.place_analyses FOR DELETE
  TO authenticated
  USING (true);
