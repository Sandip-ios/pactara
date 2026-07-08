
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS duration_days INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS days_per_week INT NOT NULL DEFAULT 7;

ALTER TABLE public.groups
  ADD CONSTRAINT groups_duration_days_positive CHECK (duration_days BETWEEN 1 AND 365),
  ADD CONSTRAINT groups_days_per_week_valid CHECK (days_per_week BETWEEN 1 AND 7),
  ADD CONSTRAINT groups_frequency_valid CHECK (frequency IN ('daily','weekly','specific'));
