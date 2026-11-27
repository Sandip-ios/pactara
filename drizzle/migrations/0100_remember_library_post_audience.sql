ALTER TABLE public.profiles ADD COLUMN last_post_audience jsonb;
CREATE OR REPLACE FUNCTION public.get_my_post_audience() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT last_post_audience FROM public.profiles WHERE id=auth.uid() $$;
REVOKE ALL ON FUNCTION public.get_my_post_audience() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_my_post_audience() TO authenticated;
CREATE OR REPLACE FUNCTION public.remember_post_audience() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.profiles SET last_post_audience=jsonb_build_object('kind',NEW.audience,'crewIds',COALESCE((SELECT jsonb_agg(group_id) FROM public.social_post_crews WHERE post_id=NEW.id),'[]'::jsonb)) WHERE id=NEW.user_id;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER remember_post_audience AFTER INSERT OR UPDATE OF audience ON public.social_posts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.remember_post_audience();
UPDATE public.profiles pr SET last_post_audience=(SELECT jsonb_build_object('kind',p.audience,'crewIds',COALESCE((SELECT jsonb_agg(group_id) FROM public.social_post_crews WHERE post_id=p.id),'[]'::jsonb)) FROM public.social_posts p WHERE p.user_id=pr.id AND p.status<>'failed' ORDER BY p.created_at DESC LIMIT 1);
