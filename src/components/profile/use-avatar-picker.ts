import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { setAvatarPath } from '@/lib/profile.functions';

export function useAvatarPicker(defer = false) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [changed, setChanged] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const pending = useRef<string[]>([]);
  const previewRef = useRef<string | null>(null);
  const qc = useQueryClient();
  const save = useServerFn(setAvatarPath);
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    if (pending.current.length) void supabase.storage.from('avatars').remove(pending.current);
  }, []);
  const savePending = async () => {
    const path = pending.current.at(-1);
    if (!path) return;
    await save({ data: { path } });
    const discarded = pending.current.slice(0, -1);
    pending.current = [];
    if (discarded.length) void supabase.storage.from('avatars').remove(discarded);
  };
  const pick = () => { if (!uploading) input.current?.click(); };
  const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error('Not signed in');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${data.user.id}/avatar-${Date.now()}.${ext}`;
      const upload = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (upload.error) throw upload.error;
      if (defer) {
        pending.current.push(path);
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = URL.createObjectURL(file);
        setPreview(previewRef.current);
      } else await save({ data: { path } });
      setChanged(true);
      await Promise.all(['member-profile', 'profile-overview', 'my-group-status', 'my-groups', 'home-crew'].map(key => qc.invalidateQueries({ queryKey: [key] })));
    } catch { toast.error("Couldn't update your photo. Please try again."); }
    finally { setUploading(false); }
  };
  return { input, uploading, changed, preview, savePending, pick, onChange };
}