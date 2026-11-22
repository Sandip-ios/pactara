CREATE POLICY "Crew members can view badges earned in their groups"
ON public.earned_badges
FOR SELECT
TO authenticated
USING (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()));