-- ============================================
-- Table de tracking consommation API
-- ============================================

CREATE TABLE api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  api_name TEXT NOT NULL,
  endpoint TEXT,
  tokens_used INTEGER,
  cost_euros NUMERIC(10, 6),
  response_time_ms INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes de monitoring
CREATE INDEX idx_api_usage_audit ON api_usage(audit_id);
CREATE INDEX idx_api_usage_api_name ON api_usage(api_name);
CREATE INDEX idx_api_usage_created ON api_usage(created_at DESC);

-- RLS permissif (même logique que les autres tables)
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on api_usage" ON api_usage FOR ALL USING (true) WITH CHECK (true);
