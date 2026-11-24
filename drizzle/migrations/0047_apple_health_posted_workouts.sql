ALTER TABLE public.profiles ADD COLUMN health_prompt_seen_at timestamptz;
ALTER TABLE public.check_ins ADD COLUMN health_workout jsonb;
CREATE TABLE public.health_preferences (user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, connected boolean NOT NULL DEFAULT false, show_workouts boolean NOT NULL DEFAULT true);
GRANT SELECT, INSERT, UPDATE ON public.health_preferences TO authenticated;
GRANT ALL ON public.health_preferences TO service_role;
ALTER TABLE public.health_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own Health preferences" ON public.health_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Members create own Health preferences" ON public.health_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members change own Health preferences" ON public.health_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE UNIQUE INDEX check_ins_health_uuid_crew ON public.check_ins(user_id, group_id, (health_workout->>'uuid')) WHERE health_workout IS NOT NULL;
CREATE FUNCTION public.validate_health_check_in() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.health_workout IS NOT NULL THEN
  IF NEW.photo_url IS NULL OR NEW.photo_url !~* '\.(mp4|mov|m4v|webm)$' THEN RAISE EXCEPTION 'A video is required for a Health check-in'; END IF;
  IF jsonb_typeof(NEW.health_workout) <> 'object' OR NOT (NEW.health_workout ?& ARRAY['uuid','source','type','start','duration','distance','calories']) OR (NEW.health_workout - ARRAY['uuid','source','type','start','duration','distance','calories']) <> '{}'::jsonb OR (NEW.health_workout->>'uuid') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Invalid Health workout'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text || (NEW.health_workout->>'uuid'), 0));
  IF EXISTS (SELECT 1 FROM public.check_ins c WHERE c.user_id = NEW.user_id AND c.health_workout->>'uuid' = NEW.health_workout->>'uuid' AND c.created_at <> NEW.created_at) THEN RAISE EXCEPTION 'This Health workout has already been used'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_health_check_in BEFORE INSERT ON public.check_ins FOR EACH ROW EXECUTE FUNCTION public.validate_health_check_in();