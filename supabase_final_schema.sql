-- ============================================================================
-- ACADFORMAT UNIFIED DATABASE SCHEMA & RLS POLICIES
-- Target System: Supabase PostgreSQL Database
-- Created: August 2026
-- Description: Complete 1-click execution script setting up all tables, enums,
--              functions, triggers, Row Level Security (RLS) policies,
--              storage bucket rules, and admin role assignments.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 2. PUBLIC PROFILES TABLE & ADMIN ROLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  institution text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ----------------------------------------------------------------------------
-- 3. DOCUMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);

-- ----------------------------------------------------------------------------
-- 4. DOCUMENT ISSUES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_issues_document ON public.document_issues(document_id);
CREATE INDEX IF NOT EXISTS idx_issues_user ON public.document_issues(user_id);

-- ----------------------------------------------------------------------------
-- 5. REVIEWS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id text PRIMARY KEY,
  author_name text NOT NULL,
  author_role text NOT NULL,
  institution text,
  rating integer NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  recommendation text,
  category text NOT NULL DEFAULT 'General',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_featured ON public.reviews(is_featured);

-- ----------------------------------------------------------------------------
-- 6. HELPER FUNCTIONS & TRIGGERS
-- ----------------------------------------------------------------------------
-- Touch updated_at timestamp function
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for touch_updated_at
DROP TRIGGER IF EXISTS profiles_touch ON public.profiles;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS documents_touch ON public.documents;
CREATE TRIGGER documents_touch BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS reviews_touch ON public.reviews;
CREATE TRIGGER reviews_touch BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper function to check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR lower(email) = 'philss7872@gmail.com')
  );
$$;

-- Automatic profile handler on auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    CASE WHEN lower(new.email) = 'philss7872@gmail.com' THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = CASE WHEN lower(EXCLUDED.email) = 'philss7872@gmail.com' THEN 'admin' ELSE profiles.role END,
      updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing auth users
INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
  COALESCE(raw_user_meta_data->>'avatar_url', ''),
  CASE WHEN lower(email) = 'philss7872@gmail.com' THEN 'admin' ELSE 'user' END
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET role = CASE WHEN lower(EXCLUDED.email) = 'philss7872@gmail.com' THEN 'admin' ELSE profiles.role END;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) & POLICIES
-- ----------------------------------------------------------------------------
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_issues TO authenticated;
GRANT ALL ON public.document_issues TO service_role;

GRANT SELECT, INSERT ON public.reviews TO anon, authenticated;
GRANT UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

-- POLICIES FOR PROFILES
DROP POLICY IF EXISTS "Users view own profile or admin" ON public.profiles;
CREATE POLICY "Users view own profile or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users update own profile or admin" ON public.profiles;
CREATE POLICY "Users update own profile or admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin());

-- POLICIES FOR DOCUMENTS
DROP POLICY IF EXISTS "Users manage own documents or admin" ON public.documents;
CREATE POLICY "Users manage own documents or admin" ON public.documents
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- POLICIES FOR DOCUMENT ISSUES
DROP POLICY IF EXISTS "Users manage own issues or admin" ON public.document_issues;
CREATE POLICY "Users manage own issues or admin" ON public.document_issues
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- POLICIES FOR REVIEWS
DROP POLICY IF EXISTS "Anyone read approved reviews" ON public.reviews;
CREATE POLICY "Anyone read approved reviews" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (status = 'approved' OR public.is_admin());

DROP POLICY IF EXISTS "Anyone create review" ON public.reviews;
CREATE POLICY "Anyone create review" ON public.reviews
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins manage all reviews" ON public.reviews;
CREATE POLICY "Admins manage all reviews" ON public.reviews
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 8. STORAGE BUCKET & STORAGE RLS POLICIES
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50 MB
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload own files" ON storage.objects;
CREATE POLICY "Users upload own files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

DROP POLICY IF EXISTS "Users read own files" ON storage.objects;
CREATE POLICY "Users read own files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

DROP POLICY IF EXISTS "Users update own files" ON storage.objects;
CREATE POLICY "Users update own files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

DROP POLICY IF EXISTS "Users delete own files" ON storage.objects;
CREATE POLICY "Users delete own files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

DROP POLICY IF EXISTS "Service role full access storage" ON storage.objects;
CREATE POLICY "Service role full access storage" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'documents');

-- ----------------------------------------------------------------------------
-- 9. INITIAL SEED DATA
-- ----------------------------------------------------------------------------
INSERT INTO public.reviews (id, author_name, author_role, institution, rating, comment, recommendation, category, status, is_featured, created_at)
VALUES
(
  'rev-1',
  'Emmanuel Ncho',
  'B.Tech Computer Engineering',
  'COLTECH, University of Bamenda',
  5,
  'AcadFormat saved my final year internship report! The College of Technology formatting rules are super strict, especially chapter titles, margins, and table of contents. AcadFormat audited my document, fixed my table numbering, and generated a flawless Word document.',
  'Highly recommended for all COLTECH students preparing their final defense documents.',
  'Internship Report',
  'approved',
  true,
  '2026-08-14T10:30:00Z'
),
(
  'rev-2',
  'Dr. Therese Mbida',
  'Senior Academic Supervisor',
  'Faculty of Engineering',
  5,
  'As a supervisor, I spent hours rejecting drafts due to missing figure captions and wrong citations. AcadFormat ensures 100% verbatim text preservation while organizing preliminary pages perfectly.',
  'Every graduating student should run their thesis through AcadFormat before submission.',
  'Dissertation',
  'approved',
  true,
  '2026-08-15T14:15:00Z'
),
(
  'rev-3',
  'Brenda Tangu',
  'M.Tech Software Engineering',
  'University of Bamenda',
  5,
  'Our Cisco VLAN lab report had complex network topology diagrams and multi-column addressing tables. Other tools destroyed the layout, but AcadFormat extracted all figures and kept tables intact!',
  'Essential for technical lab reports with embedded diagrams and CLI command snippets.',
  'Lab Report',
  'approved',
  true,
  '2026-08-16T09:45:00Z'
),
(
  'rev-4',
  'Kevin Fobi',
  'B.Eng Electrical Engineering',
  'NAHPI, University of Bamenda',
  4,
  'The automatic generation of List of Figures, List of Tables, and Abbreviations list saved me two days of manual work.',
  'Great platform. The PDF export and Word doc download both look clean and professional.',
  'Project Report',
  'approved',
  false,
  '2026-08-16T12:20:00Z'
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 10. REALTIME PUBLICATION CONFIGURATION
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles, public.documents, public.reviews;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if table already in publication
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- END OF SCHEMA
-- ----------------------------------------------------------------------------
