CREATE OR REPLACE FUNCTION public.social_post_items_length_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE everyone boolean; len numeric;
BEGIN
  IF NEW.kind <> 'video' THEN RETURN NEW; END IF;
  SELECT audience_everyone INTO everyone FROM public.social_posts WHERE id = NEW.post_id;
  len := COALESCE(NEW.trim_end, NEW.duration_s, 0) - COALESCE(NEW.trim_start, 0);
  IF len > (CASE WHEN everyone THEN 600 ELSE 180 END) + 0.5 THEN
    RAISE EXCEPTION '%', CASE WHEN everyone THEN 'Videos can be up to 10:00. Trim it to post.' ELSE 'Crew-only posts take videos up to 3:00. Trim it or turn on Everyone.' END USING ERRCODE = '22023';
  END IF;
  IF len > 180.5 THEN
    UPDATE public.social_posts SET skip_discover = true WHERE id = NEW.post_id AND NOT skip_discover;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER social_post_items_length_guard BEFORE INSERT OR UPDATE ON public.social_post_items FOR EACH ROW EXECUTE FUNCTION public.social_post_items_length_guard();