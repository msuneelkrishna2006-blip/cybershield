-- CyberShield 2.0 Supabase Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
