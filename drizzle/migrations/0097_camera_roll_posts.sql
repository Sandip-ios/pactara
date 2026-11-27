CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 2200),
  audience_everyone boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','live','failed')),
  comments_on boolean NOT NULL DEFAULT true,
  workout_session_id uuid,
  workout_id uuid,
  workout jsonb,
  credit_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  skip_discover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_posts_user_created_idx ON public.social_posts (user_id, created_at DESC);

CREATE TABLE public.social_post_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  position int NOT NULL,
  kind text NOT NULL CHECK (kind IN ('photo','video')),
  path text NOT NULL,
  poster_path text,
  duration_s numeric,
  trim_start numeric,
  trim_end numeric,
  muted boolean NOT NULL DEFAULT false,
  cover_s numeric,
  crop jsonb,
  UNIQUE (post_id, position)
);
CREATE TABLE public.social_post_crews (
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, group_id)
);
CREATE INDEX social_post_crews_group_idx ON public.social_post_crews (group_id);
CREATE TABLE public.social_post_tags (
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE public.social_post_cheers (
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE public.social_post_saves (
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE public.social_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_post_comments_post_idx ON public.social_post_comments (post_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts, public.social_post_items, public.social_post_crews, public.social_post_tags, public.social_post_cheers, public.social_post_saves, public.social_post_comments TO authenticated;
GRANT ALL ON public.social_posts, public.social_post_items, public.social_post_crews, public.social_post_tags, public.social_post_cheers, public.social_post_saves, public.social_post_comments TO service_role;

CREATE OR REPLACE FUNCTION public.can_see_social_post(_post_id uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.social_posts p
    WHERE p.id = _post_id AND (
      p.user_id = _viewer OR (
        p.status = 'live'
        AND NOT public.safety_pair_blocked(p.user_id, _viewer)
        AND (
          EXISTS (SELECT 1 FROM public.social_post_crews pc JOIN public.group_members gm ON gm.group_id = pc.group_id AND gm.user_id = _viewer WHERE pc.post_id = p.id)
          OR (p.audience_everyone AND (
            NOT COALESCE((SELECT pr.is_private FROM public.profiles pr WHERE pr.id = p.user_id), true)
            OR EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = _viewer AND f.following_id = p.user_id AND f.status = 'accepted')
          ))
        )
      )
    )
  )
$$;
REVOKE ALL ON FUNCTION public.can_see_social_post(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_see_social_post(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.social_posts_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b date;
BEGIN
  IF NEW.audience_everyone THEN
    SELECT birthday INTO b FROM public.profiles WHERE id = NEW.user_id;
    IF b IS NOT NULL AND b > (current_date - interval '18 years') THEN
      RAISE EXCEPTION 'Under-18 accounts can only post to their crews' USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER social_posts_guard BEFORE INSERT OR UPDATE ON public.social_posts FOR EACH ROW EXECUTE FUNCTION public.social_posts_guard();

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_cheers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social posts visible" ON public.social_posts FOR SELECT TO authenticated USING (public.can_see_social_post(id, auth.uid()));
CREATE POLICY "social posts own update" ON public.social_posts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "social posts own delete" ON public.social_posts FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "social post items visible" ON public.social_post_items FOR SELECT TO authenticated USING (public.can_see_social_post(post_id, auth.uid()));
CREATE POLICY "social post crews visible" ON public.social_post_crews FOR SELECT TO authenticated USING (public.can_see_social_post(post_id, auth.uid()));
CREATE POLICY "social post tags visible" ON public.social_post_tags FOR SELECT TO authenticated USING (public.can_see_social_post(post_id, auth.uid()));
CREATE POLICY "social post cheers visible" ON public.social_post_cheers FOR SELECT TO authenticated USING (public.can_see_social_post(post_id, auth.uid()));
CREATE POLICY "social post cheers own insert" ON public.social_post_cheers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_see_social_post(post_id, auth.uid()));
CREATE POLICY "social post cheers own delete" ON public.social_post_cheers FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "social post saves read" ON public.social_post_saves FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "social post saves own insert" ON public.social_post_saves FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_see_social_post(post_id, auth.uid()));
CREATE POLICY "social post saves own delete" ON public.social_post_saves FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "social post comments visible" ON public.social_post_comments FOR SELECT TO authenticated USING (public.can_see_social_post(post_id, auth.uid()) AND NOT public.safety_pair_blocked(user_id, auth.uid()));
CREATE POLICY "social post comments own insert" ON public.social_post_comments FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND public.can_see_social_post(post_id, auth.uid())
  AND EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = post_id AND p.comments_on)
);
CREATE POLICY "social post comments delete" ON public.social_post_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.create_social_post(_caption text, _everyone boolean, _group_ids uuid[], _items jsonb, _workout jsonb, _workout_session_id uuid, _workout_id uuid, _credit_user_id uuid, _comments_on boolean, _tags uuid[], _skip_discover boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); pid uuid; g uuid; it jsonb; i int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  IF NOT COALESCE(_everyone, false) AND COALESCE(array_length(_group_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Pick who sees it' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(COALESCE(_items, '[]'::jsonb)) > 10 THEN RAISE EXCEPTION 'Up to 10 items' USING ERRCODE = '22023'; END IF;
  FOREACH g IN ARRAY COALESCE(_group_ids, '{}') LOOP
    IF NOT public.is_group_member(g, uid) THEN RAISE EXCEPTION 'Not in that crew' USING ERRCODE = '42501'; END IF;
  END LOOP;
  INSERT INTO public.social_posts (user_id, caption, audience_everyone, comments_on, workout, workout_session_id, workout_id, credit_user_id, skip_discover, status)
  VALUES (uid, COALESCE(_caption, ''), COALESCE(_everyone, false), COALESCE(_comments_on, true), _workout, _workout_session_id, _workout_id, _credit_user_id, COALESCE(_skip_discover, false),
    CASE WHEN jsonb_array_length(COALESCE(_items, '[]'::jsonb)) = 0 THEN 'live' ELSE 'uploading' END)
  RETURNING id INTO pid;
  INSERT INTO public.social_post_crews (post_id, group_id) SELECT pid, x FROM unnest(COALESCE(_group_ids, '{}')) AS x ON CONFLICT DO NOTHING;
  INSERT INTO public.social_post_tags (post_id, user_id) SELECT pid, x FROM unnest(COALESCE(_tags, '{}')) AS x WHERE x <> uid ON CONFLICT DO NOTHING;
  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) LOOP
    IF split_part(it->>'path', '/', 1) <> uid::text THEN RAISE EXCEPTION 'Bad media path' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.social_post_items (post_id, position, kind, path, poster_path, duration_s, trim_start, trim_end, muted, cover_s, crop)
    VALUES (pid, i, it->>'kind', it->>'path', it->>'poster_path', (it->>'duration_s')::numeric, (it->>'trim_start')::numeric, (it->>'trim_end')::numeric,
      COALESCE((it->>'muted')::boolean, false), (it->>'cover_s')::numeric, it->'crop');
    i := i + 1;
  END LOOP;
  RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.create_social_post(text, boolean, uuid[], jsonb, jsonb, uuid, uuid, uuid, boolean, uuid[], boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_social_post(text, boolean, uuid[], jsonb, jsonb, uuid, uuid, uuid, boolean, uuid[], boolean) TO authenticated;

CREATE POLICY "posts media own upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'posts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "posts media own delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'posts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "posts media read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'posts' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.social_post_items pi WHERE (pi.path = name OR pi.poster_path = name) AND public.can_see_social_post(pi.post_id, auth.uid()))
  )
);