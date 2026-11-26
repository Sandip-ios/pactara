import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BellOff, X } from "lucide-react";
import { NOTIF_BANNER_KEY, NOTIF_BANNER_SNOOZE_MS, notifBannerBody, shouldShowNotifBanner } from "@/lib/notif-banner";
import { usePushPermission } from "@/lib/use-push-permission";

export function NewNotifBanner({ crewNames }: { crewNames: string[] }) {
  const navigate = useNavigate();
  const { permission, native, request } = usePushPermission();
  const [hiddenUntil, setHiddenUntil] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const v = Number(localStorage.getItem(NOTIF_BANNER_KEY)); setHiddenUntil(v > 0 ? v : null); } catch { /* private mode */ }
    setReady(true);
  }, []);
  if (!ready || !shouldShowNotifBanner({ native, permission, activeCrews: crewNames.length, hiddenUntil, now: Date.now() })) return null;

  const hide = () => {
    const until = Date.now() + NOTIF_BANNER_SNOOZE_MS;
    setHiddenUntil(until);
    try { localStorage.setItem(NOTIF_BANNER_KEY, String(until)); } catch { /* private mode */ }
  };
  const turnOn = async () => {
    if (permission === "denied") return void navigate({ to: "/notifications-off" });
    const next = await request();
    if (next === "denied") void navigate({ to: "/notifications-off" });
  };

  return (
    <div className="flex items-center" style={{ margin: "12px 12px 0", borderRadius: 18, background: "#141218", color: "#FFFFFF", padding: "12px 14px", gap: 12 }}>
      <BellOff size={20} className="shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold leading-snug">Notifications are off</p>
        <p className="text-[12px] leading-snug" style={{ opacity: 0.75 }}>{notifBannerBody(crewNames)}</p>
      </div>
      <button type="button" onClick={() => void turnOn()} className="shrink-0 whitespace-nowrap text-[13px] font-bold" style={{ height: 32, padding: "0 12px", borderRadius: 16, background: "#FFFFFF", color: "#141218" }}>Turn on</button>
      <button type="button" aria-label="Hide for 7 days" onClick={hide} className="-my-2 -ml-2 -mr-3 flex h-11 w-11 shrink-0 items-center justify-center"><X size={16} style={{ opacity: 0.6 }} /></button>
    </div>
  );
}
