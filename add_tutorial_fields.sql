-- Add tutorial fields to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS has_seen_tutorial boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_tutorial_enabled boolean DEFAULT true;
