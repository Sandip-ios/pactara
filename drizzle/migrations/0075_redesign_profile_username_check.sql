CREATE FUNCTION public.is_profile_username_available(candidate text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF candidate IS NULL OR candidate !~ '^[a-z0-9._]{3,30}$' THEN RETURN false; END IF;
 RETURN NOT EXISTS(SELECT 1 FROM public.profiles WHERE lower(username)=candidate AND id<>auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.is_profile_username_available(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_profile_username_available(text) TO authenticated;