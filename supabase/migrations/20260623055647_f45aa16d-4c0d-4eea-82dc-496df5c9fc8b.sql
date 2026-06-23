
CREATE POLICY "Group members can read chat photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-photos'
    AND public.is_group_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "Group members can upload chat photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-photos'
    AND public.is_group_member((storage.foldername(name))[1]::uuid, auth.uid())
    AND owner = auth.uid()
  );

CREATE POLICY "Senders can delete own chat photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-photos' AND owner = auth.uid());
