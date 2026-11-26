import { useEffect } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useHideBottomTabs } from "@/hooks/use-hide-bottom-tabs";
import { openAppSettings } from "@/lib/contacts";
import { usePushPermission } from "@/lib/use-push-permission";

/** "Turn on notifications in Settings": closes itself once permission is back on. */
export function NewNotifSettings() {
  useHideBottomTabs(true, false);
  const navigate = useNavigate();
  const router = useRouter();
  const { permission } = usePushPermission();
  const back = () => (window.history.length > 1 ? router.history.back() : navigate({ to: "/home" }));
  useEffect(() => { if (permission === "granted") back(); }, [permission]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 flex flex-col bg-white" style={{ color: "#1C1917", fontFamily: "Inter, system-ui, sans-serif" }}>
      <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-new-top">
        <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full" style={{ marginTop: 74, background: "#EDE4FF" }}>
          <Bell size={32} style={{ color: "#7C3AED" }} aria-hidden />
        </div>
        <h1 className="text-center text-[28px] font-extrabold leading-tight" style={{ marginTop: 18 }}>Turn on notifications in Settings</h1>
        <p className="text-center text-[16px]" style={{ marginTop: 10, color: "#57534E", lineHeight: 1.45 }}>You said no earlier, so iPhone needs you to turn them on yourself. Tap below, then Notifications, then Allow.</p>
      </main>
      <div className="shrink-0 px-6 pt-3" style={{ paddingBottom: "calc(max(env(safe-area-inset-bottom), 16px) + 24px)" }}>
        <button type="button" onClick={() => void openAppSettings()} className="h-[52px] w-full rounded-[26px] text-[17px] font-bold text-white" style={{ background: "#7C3AED" }}>Open iPhone Settings</button>
        <button type="button" onClick={back} className="mt-2 h-11 w-full text-[15px] font-semibold" style={{ color: "#57534E" }}>Not now</button>
      </div>
    </div>
  );
}
