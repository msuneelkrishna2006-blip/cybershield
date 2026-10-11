-- CyberShield 2.0 Supabase Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Authentication tables for deployments using Supabase Auth.
-- The Prisma application currently uses its own public.users identity table.
-- These tables intentionally reference auth.users and must not be mixed with
-- the Prisma-backed identity store in the same authentication deployment.
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('GUARDIAN', 'CHILD', 'ADMIN')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    password_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.otp_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'login',
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mfa_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_secret TEXT NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL UNIQUE,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.aadhaar_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_reference_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    last_four_encrypted TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    version TEXT NOT NULL,
    consented_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    withdrawn_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
    window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS otp_challenges_phone_sent_at_idx
    ON public.otp_challenges (phone, sent_at);
CREATE INDEX IF NOT EXISTS otp_challenges_expires_at_idx
    ON public.otp_challenges (expires_at);
CREATE INDEX IF NOT EXISTS email_tokens_user_purpose_expiry_idx
    ON public.email_tokens (user_id, purpose, expires_at);
CREATE INDEX IF NOT EXISTS sessions_user_expiry_idx
    ON public.sessions (user_id, expires_at);
CREATE INDEX IF NOT EXISTS recovery_codes_user_used_idx
    ON public.recovery_codes (user_id, used_at);
CREATE INDEX IF NOT EXISTS aadhaar_verifications_user_status_idx
    ON public.aadhaar_verifications (user_id, status);
CREATE INDEX IF NOT EXISTS consents_user_purpose_time_idx
    ON public.consents (user_id, purpose, consented_at);
CREATE INDEX IF NOT EXISTS audit_logs_user_time_idx
    ON public.audit_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_type_time_idx
    ON public.audit_logs (event_type, created_at);
CREATE INDEX IF NOT EXISTS auth_rate_limits_window_started_at_idx
    ON public.auth_rate_limits (window_started_at);

-- Secrets and tokens are only accessible to trusted server-side code.
-- No authenticated-client policy is defined for these tables, so RLS denies
-- direct client access. Service-role access is handled by the backend.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aadhaar_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own role" ON public.user_roles
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "No client access to credentials" ON public.credentials
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client access to OTP challenges" ON public.otp_challenges
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client access to email tokens" ON public.email_tokens
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client access to sessions" ON public.sessions
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client access to MFA secrets" ON public.mfa_secrets
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client access to recovery codes" ON public.recovery_codes
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client access to Aadhaar verifications" ON public.aadhaar_verifications
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Users can read their own consent records" ON public.consents
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "No client access to audit logs" ON public.audit_logs
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client access to authentication rate limits" ON public.auth_rate_limits
    FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Create Families table
CREATE TABLE IF NOT EXISTS public.families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Family Members table (links Auth Users to Families)
CREATE TABLE IF NOT EXISTS public.family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('guardian', 'adult', 'child', 'elderly')),
    relation TEXT NOT NULL,
    risk_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, family_id)
);

-- Create Scan Records table
CREATE TABLE IF NOT EXISTS public.scan_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    input TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    risk_level TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT,
    recommendations JSONB DEFAULT '[]'::jsonb,
    agent_results JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security (RLS)

-- Families: Users can read/update their own families
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own families" ON public.families 
FOR SELECT USING (owner_id = auth.uid() OR id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Family Members: Users can view members of their family
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view members of their family" ON public.family_members 
FOR SELECT USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Scan Records: Users can view scans for their family
ALTER TABLE public.scan_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view scans for their family" ON public.scan_records 
FOR SELECT USING (member_id IN (SELECT id FROM public.family_members WHERE family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())));

-- Alerts: Users can view alerts for their family
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view alerts for their family" ON public.alerts 
FOR SELECT USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

-- Create trigger to automatically create a user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into a public profiles table if you create one, or just create a default family
  INSERT INTO public.families (name, owner_id)
  VALUES (NEW.raw_user_meta_data->>'full_name' || '''s Family', NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
