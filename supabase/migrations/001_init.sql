-- Migration 001 : Initialisation des tables Valtools-audit
-- À exécuter dans le SQL Editor de Supabase Dashboard

-- Historique des audits
CREATE TABLE IF NOT EXISTS audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  destination TEXT NOT NULL,
  code_insee TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'error')),
  completed_at TIMESTAMPTZ
);

-- Résultats par module
CREATE TABLE IF NOT EXISTS audit_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN (
    'notoriete',
    'volume-affaires',
    'schema-digital',
    'seo',
    'stocks-physiques',
    'stocks-commerciaux',
    'benchmark'
  )),
  data JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_audits_destination ON audits(destination);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audit_results_audit_id ON audit_results(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_module ON audit_results(module);

-- Désactiver RLS pour simplifier le développement initial
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;

-- Policies permissives (à resserrer en production)
CREATE POLICY "Allow all on audits" ON audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on audit_results" ON audit_results FOR ALL USING (true) WITH CHECK (true);
