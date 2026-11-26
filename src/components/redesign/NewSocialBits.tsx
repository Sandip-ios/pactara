import { ChevronLeft } from 'lucide-react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NewAvatarFallback } from './NewAvatarFallback';

export function SocialHeader({ title }: { title: string }) {
  const router = useRouter(); const navigate = useNavigate();
  return <header className="new-profile-header pt-new-top"><div className="new-profile-header-row"><Button variant="ghost" className="new-profile-menu-button" aria-label="Back" onClick={() => { if (router.history.canGoBack()) router.history.back(); else void navigate({ to: '/profile' }); }}><ChevronLeft size={24} /></Button><h1>{title}</h1><span className="new-profile-header-spacer" /></div></header>;
}

export function SocialAvatar({ url, size }: { url: string | null; size: 32 | 40 | 48 }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <span className={`new-social-avatar size-${size}`} aria-hidden>{url && url !== failed ? <img src={url} alt="" onError={() => setFailed(url)} /> : <NewAvatarFallback />}</span>;
}