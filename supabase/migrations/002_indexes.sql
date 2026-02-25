-- ============================================================
-- Migration 002 — Index
-- GIN sur colonnes JSONB + btree sur colonnes scalaires
-- ============================================================

-- ─── destinations ────────────────────────────────────────────

-- Recherche rapide par code INSEE (autocomplete, audit)
CREATE INDEX idx_destinations_code_insee
  ON public.destinations USING btree (code_insee);

-- Recherche par département (filtres dashboard)
CREATE INDEX idx_destinations_code_departement
  ON public.destinations USING btree (code_departement);

-- ─── audits ──────────────────────────────────────────────────

-- FK — jointure destinations → audits
CREATE INDEX idx_audits_destination_id
  ON public.audits USING btree (destination_id);

-- Filtrage par statut (dashboard, polling progression)
CREATE INDEX idx_audits_statut
  ON public.audits USING btree (statut);

-- Tri chronologique (dashboard)
CREATE INDEX idx_audits_created_at
  ON public.audits USING btree (created_at DESC);

-- Index GIN global sur resultats — permet jsonb @>, ?, ?|, ?&
CREATE INDEX idx_audits_resultats_gin
  ON public.audits USING gin (resultats);

-- Index GIN global sur couts_api — analyse des coûts
CREATE INDEX idx_audits_couts_api_gin
  ON public.audits USING gin (couts_api);

-- Index expression — score_gap Bloc 4 (comparaisons inter-destinations)
CREATE INDEX idx_audits_score_gap
  ON public.audits USING btree (
    ((resultats -> 'visibilite_seo' -> 'phase_b' ->> 'score_gap')::int)
  )
  WHERE resultats -> 'visibilite_seo' -> 'phase_b' IS NOT NULL;

-- Index expression — score visibilité OT Bloc 3 (tri dashboard)
CREATE INDEX idx_audits_score_visibilite_ot
  ON public.audits USING btree (
    ((resultats -> 'schema_digital' ->> 'score_visibilite_ot')::int)
  )
  WHERE resultats -> 'schema_digital' IS NOT NULL;

-- Index expression — note Google OT (comparaisons)
CREATE INDEX idx_audits_note_google_ot
  ON public.audits USING btree (
    ((resultats -> 'positionnement' -> 'google' -> 'ot' ->> 'note')::numeric)
  )
  WHERE resultats -> 'positionnement' -> 'google' -> 'ot' ? 'note';

-- Index expression — total stock physique Bloc 5
CREATE INDEX idx_audits_total_stock
  ON public.audits USING btree (
    ((resultats -> 'stocks_physiques' -> 'stocks' ->> 'total_stock_physique')::int)
  )
  WHERE resultats -> 'stocks_physiques' IS NOT NULL;

-- ─── competitors ─────────────────────────────────────────────

-- FK — jointure audits → competitors
CREATE INDEX idx_competitors_audit_id
  ON public.competitors USING btree (audit_id);

-- GIN sur metriques (queries ad-hoc sur les métriques concurrents)
CREATE INDEX idx_competitors_metriques_gin
  ON public.competitors USING gin (metriques);
