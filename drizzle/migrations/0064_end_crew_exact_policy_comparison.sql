DROP POLICY IF EXISTS "Ended crew check-ins preserve own history" ON public.check_ins;
DROP POLICY IF EXISTS "Ended crew posts preserve own history" ON public.daily_posts;
DROP POLICY IF EXISTS "Ended crew chat is closed" ON public.group_messages;
DROP POLICY IF EXISTS "Ended crew comments are closed" ON public.post_comments;
DROP POLICY IF EXISTS "Ended crew reactions are closed" ON public.post_reactions;
DROP POLICY IF EXISTS "Ended crew message reactions are closed" ON public.message_reactions;
DROP POLICY IF EXISTS "Ended crew comment likes are closed" ON public.comment_likes;
DROP POLICY IF EXISTS "Ended crew cheers are closed" ON public.workout_cheers;