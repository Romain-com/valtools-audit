-- ============================================================
-- Migration 003 — Row Level Security
-- Politique : tout utilisateur authentifié peut lire et écrire
-- (usage interne 2-5 personnes — pas d'exposition publique)
-- ============================================================

-- ─── Activation RLS ──────────────────────────────────────────

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors  ENABLE ROW LEVEL SECURITY;

-- ─── profiles ────────────────────────────────────────────────

-- Lecture : chaque utilisateur voit tous les profils (pour afficher les noms collaborateurs)
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Insertion : uniquement son propre profil (créé par trigger)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Mise à jour : uniquement son propre profil
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- ─── destinations ────────────────────────────────────────────

CREATE POLICY "destinations_select_authenticated"
  ON public.destinations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "destinations_insert_authenticated"
  ON public.destinations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "destinations_update_authenticated"
  ON public.destinations FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "destinations_delete_authenticated"
  ON public.destinations FOR DELETE
  TO authenticated
  USING (true);

-- ─── audits ──────────────────────────────────────────────────

CREATE POLICY "audits_select_authenticated"
  ON public.audits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "audits_insert_authenticated"
  ON public.audits FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "audits_update_authenticated"
  ON public.audits FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "audits_delete_authenticated"
  ON public.audits FOR DELETE
  TO authenticated
  USING (true);

-- ─── competitors ─────────────────────────────────────────────

CREATE POLICY "competitors_select_authenticated"
  ON public.competitors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "competitors_insert_authenticated"
  ON public.competitors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "competitors_update_authenticated"
  ON public.competitors FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "competitors_delete_authenticated"
  ON public.competitors FOR DELETE
  TO authenticated
  USING (true);

-- ─── Accès service_role (bypass RLS pour les Route Handlers) ─
-- Le service_role Supabase bypasse RLS automatiquement — aucune policy nécessaire.
-- S'assurer d'utiliser le client Supabase avec SUPABASE_SERVICE_ROLE_KEY dans les Route Handlers.
