CREATE TABLE public.meal_food_add_counts (food_id text PRIMARY KEY, adds integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.meal_food_add_counts TO service_role;
ALTER TABLE public.meal_food_add_counts ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.bump_meal_food_adds(_ids text[]) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 INSERT INTO public.meal_food_add_counts(food_id,adds) SELECT id,count(*) FROM unnest(_ids) id GROUP BY id
 ON CONFLICT (food_id) DO UPDATE SET adds=meal_food_add_counts.adds+EXCLUDED.adds, updated_at=now();
$$;
REVOKE ALL ON FUNCTION public.bump_meal_food_adds(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_meal_food_adds(text[]) TO service_role;