CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  error_message text,
  raw_text text,
  understanding jsonb,
  model jsonb,
  health jsonb,
  institution jsonb,
  final_document jsonb,
  final_audit jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own documents" ON public.documents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.document_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category text NOT NULL,
  location text NOT NULL,
  problem text NOT NULL,
  explanation text,
  suggestion text,
  confidence integer NOT NULL DEFAULT 50,
  severity text NOT NULL DEFAULT 'medium',
  decision text NOT NULL DEFAULT 'pending',
  user_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_issues TO authenticated;
GRANT ALL ON public.document_issues TO service_role;
ALTER TABLE public.document_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own issues" ON public.document_issues FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_documents_user ON public.documents(user_id, created_at DESC);
CREATE INDEX idx_issues_document ON public.document_issues(document_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER documents_touch BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();