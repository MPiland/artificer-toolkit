ALTER TABLE public.user_roll_history
ADD COLUMN IF NOT EXISTS consumed_at timestamptz;
