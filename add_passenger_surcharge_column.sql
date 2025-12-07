-- Migration to add passenger_surcharge_per_km column to user_profiles table

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS passenger_surcharge_per_km numeric DEFAULT 0;

COMMENT ON COLUMN public.user_profiles.passenger_surcharge_per_km IS 'Surcharge amount per kilometer for passengers';
