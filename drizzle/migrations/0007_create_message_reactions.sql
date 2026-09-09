CREATE TABLE public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read message reactions"
ON public.message_reactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_messages gm
    WHERE gm.id = message_reactions.message_id
      AND public.is_group_member(gm.group_id, auth.uid())
  )
);

CREATE POLICY "members add own message reactions"
ON public.message_reactions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.group_messages gm
    WHERE gm.id = message_reactions.message_id
      AND public.is_group_member(gm.group_id, auth.uid())
  )
);

CREATE POLICY "users remove own message reactions"
ON public.message_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX message_reactions_message_idx ON public.message_reactions(message_id);