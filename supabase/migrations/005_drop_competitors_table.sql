-- ============================================================
-- Migration 005 — Suppression table competitors
-- Les concurrents sont stockés uniquement dans
-- audits.resultats.concurrents (JSONB) — pas de table dédiée
-- ============================================================

DROP TABLE IF EXISTS public.competitors;
DROP TYPE  IF EXISTS type_concurrent;
