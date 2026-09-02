-- Create admin_alerts table for telemetry from the verification audit engine
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id       UUID NOT NULL,
  document_id   UUID NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'WARNING', -- 'CRITICAL' | 'WARNING' | 'NONE'
  triggered     BOOLEAN NOT NULL DEFAULT true,
  checks        JSONB,   -- full per-check PASSED/FAILED map
  persistent_errors JSONB, -- array of { category, description, recommendedAction }
  reconstruction_status TEXT NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS' | 'AUTO_REMEDIATED' | 'FAILED'
  download_ready BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can read all alerts; service role bypasses RLS automatically
CREATE POLICY "Service role full access to admin_alerts"
  ON public.admin_alerts
  FOR ALL
  USING (true)
  WITH CHECK (true);
