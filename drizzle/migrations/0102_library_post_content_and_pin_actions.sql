CREATE OR REPLACE FUNCTION public.set_social_post_content(_post_id uuid, _caption text, _workout jsonb, _workout_session_id uuid, _workout_id uuid, _credit_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.social_posts WHERE id = _post_id AND user_id = uid FOR UPDATE) THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = '42501';
  END IF;
  UPDATE public.social_posts SET caption = COALESCE(_caption, ''), workout = _workout, workout_session_id = _workout_session_id, workout_id = _workout_id, credit_user_id = _credit_user_id WHERE id = _post_id;
END $$;
REVOKE ALL ON FUNCTION public.set_social_post_content(uuid, text, jsonb, uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_social_post_content(uuid, text, jsonb, uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_social_post_pin(_post_id uuid, _pinned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.social_posts WHERE id = _post_id AND user_id = uid FOR UPDATE) THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = '42501';
  END IF;
  UPDATE public.social_posts SET pinned_at = CASE WHEN _pinned THEN now() ELSE NULL END WHERE id = _post_id;
END $$;
REVOKE ALL ON FUNCTION public.set_social_post_pin(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_social_post_pin(uuid, boolean) TO authenticated;