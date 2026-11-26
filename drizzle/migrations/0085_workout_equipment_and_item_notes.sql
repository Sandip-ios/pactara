ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS equipment text;
ALTER TABLE public.workouts ADD CONSTRAINT workouts_equipment_check CHECK (equipment IS NULL OR equipment IN ('gym','dumbbells','home'));
COMMENT ON COLUMN public.workouts.equipment IS 'New version: gym | dumbbells | home (home = bodyweight or bands). Null for older workouts.';
COMMENT ON COLUMN public.workouts.exercises IS 'Ordered items: {exerciseId, sets, restSeconds?, seconds?, reps? (text like "8", "10 each"), tip? (max 120 chars)}';