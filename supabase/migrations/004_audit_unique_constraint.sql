-- ============================================================
-- Migration 004 — Contrainte UNIQUE audits.destination_id
-- Un seul audit actif par destination — les données sont
-- écrasées lors d'un relancement (pas d'historique temporel)
-- ============================================================

ALTER TABLE public.audits
  ADD CONSTRAINT audits_destination_id_unique
  UNIQUE (destination_id);
