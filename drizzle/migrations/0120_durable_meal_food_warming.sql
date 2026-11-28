CREATE TABLE public.meal_food_warm_control (id boolean PRIMARY KEY DEFAULT true CHECK(id), token uuid NOT NULL DEFAULT gen_random_uuid(), lease_id uuid, leased_until timestamptz);
GRANT ALL ON public.meal_food_warm_control TO service_role;
ALTER TABLE public.meal_food_warm_control ENABLE ROW LEVEL SECURITY;
INSERT INTO public.meal_food_warm_control(id) VALUES(true);
CREATE TABLE public.meal_food_warm_terms (term text PRIMARY KEY, ordinal integer NOT NULL DEFAULT 0, warmed_at timestamptz, version text NOT NULL DEFAULT '', attempted_at timestamptz, lease_id uuid, leased_until timestamptz, last_error text);
GRANT ALL ON public.meal_food_warm_terms TO service_role;
ALTER TABLE public.meal_food_warm_terms ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.meal_usda_warm_budget (hour timestamptz PRIMARY KEY, requests integer NOT NULL DEFAULT 0 CHECK(requests>=0));
GRANT ALL ON public.meal_usda_warm_budget TO service_role;
ALTER TABLE public.meal_usda_warm_budget ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.claim_meal_food_warm_run(_token text, _terms text[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed uuid;
BEGIN
 IF cardinality(_terms)>300 THEN RETURN NULL; END IF;
 UPDATE public.meal_food_warm_control SET lease_id=gen_random_uuid(), leased_until=now()+interval '5 minutes' WHERE id AND token::text=_token AND (leased_until IS NULL OR leased_until<now()) RETURNING lease_id INTO claimed;
 IF claimed IS NULL THEN RETURN NULL; END IF;
 INSERT INTO public.meal_food_warm_terms(term,ordinal) SELECT term,ordinal::integer FROM unnest(_terms) WITH ORDINALITY AS t(term,ordinal) ON CONFLICT(term) DO NOTHING;
 RETURN claimed;
END $$;
CREATE FUNCTION public.claim_meal_food_warm_term(_version text,_lease uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE picked text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.meal_food_warm_control WHERE id AND lease_id=_lease AND leased_until>now()) THEN RETURN NULL; END IF;
 SELECT term INTO picked FROM public.meal_food_warm_terms WHERE (warmed_at IS NULL OR version<>_version) AND (leased_until IS NULL OR leased_until<now()) ORDER BY attempted_at NULLS FIRST,ordinal FOR UPDATE SKIP LOCKED LIMIT 1;
 IF picked IS NULL THEN RETURN NULL; END IF;
 UPDATE public.meal_food_warm_terms SET lease_id=_lease,leased_until=now()+interval '5 minutes',attempted_at=now() WHERE term=picked;
 RETURN picked;
END $$;
CREATE FUNCTION public.finish_meal_food_warm_term(_term text,_version text,_lease uuid,_success boolean,_error text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.meal_food_warm_terms SET warmed_at=CASE WHEN _success THEN now() ELSE warmed_at END, version=CASE WHEN _success THEN _version ELSE version END, leased_until=NULL,lease_id=NULL,last_error=left(_error,120) WHERE term=_term AND lease_id=_lease;
$$;
CREATE FUNCTION public.release_meal_food_warm_run(_lease uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.meal_food_warm_control SET leased_until=NULL,lease_id=NULL WHERE id AND lease_id=_lease;
$$;
CREATE FUNCTION public.claim_meal_usda_warm_search(_requests integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h timestamptz:=date_trunc('hour',now()); used integer; warm_used integer;
BEGIN
 IF _requests<1 OR _requests>5 THEN RETURN false; END IF;
 INSERT INTO public.meal_usda_budget(hour,requests) VALUES(h,0) ON CONFLICT(hour) DO NOTHING;
 SELECT requests INTO used FROM public.meal_usda_budget WHERE hour=h FOR UPDATE;
 INSERT INTO public.meal_usda_warm_budget(hour,requests) VALUES(h,0) ON CONFLICT(hour) DO NOTHING;
 SELECT requests INTO warm_used FROM public.meal_usda_warm_budget WHERE hour=h FOR UPDATE;
 IF used+_requests>300 OR warm_used+_requests>300 THEN RETURN false; END IF;
 UPDATE public.meal_usda_budget SET requests=requests+_requests WHERE hour=h;
 UPDATE public.meal_usda_warm_budget SET requests=requests+_requests WHERE hour=h;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.claim_meal_food_warm_run(text,text[]),public.claim_meal_food_warm_term(text,uuid),public.finish_meal_food_warm_term(text,text,uuid,boolean,text),public.release_meal_food_warm_run(uuid),public.claim_meal_usda_warm_search(integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meal_food_warm_run(text,text[]),public.claim_meal_food_warm_term(text,uuid),public.finish_meal_food_warm_term(text,text,uuid,boolean,text),public.release_meal_food_warm_run(uuid),public.claim_meal_usda_warm_search(integer) TO service_role;