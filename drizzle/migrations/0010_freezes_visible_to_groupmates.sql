CREATE POLICY "Group members view freezes in their groups"
ON public.streak_freezes_used
FOR SELECT
TO authenticated
USING (public.is_group_member(group_id, auth.uid()));