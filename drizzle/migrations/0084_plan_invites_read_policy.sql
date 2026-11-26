ALTER POLICY plan_invites_recipient ON public.plan_invite_notifications
  USING (recipient_id = auth.uid() AND public.can_read_follow_notifications());