import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Flame, CalendarDays, Target, Zap, SlidersHorizontal, LogOut, ChevronRight, Camera, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProfileOverview, setAvatarPath } from "@/lib/profile.functions";

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";
const BG = "#F5F2EE";
const GREEN = "#22C55E";
const GREEN_SOFT = "#DCFCE7";
const RED_SOFT = "#FEE2E2";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const saveAvatarPath = useServerFn(setAvatarPath);

  const { data } = useQuery({
    queryKey: ["profile-overview"],
    queryFn: () => getProfileOverview(),
  });

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const openPicker = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setUploading(true);
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) throw userErr ?? new Error("Not signed in");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userRes.user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      await saveAvatarPath({ data: { path } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["my-group-status"] }),
        queryClient.invalidateQueries({ queryKey: ["my-groups"] }),
      ]);
    } catch (err) {
      console.error("Avatar upload failed", err);
      alert("Couldn't update your photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const name = data?.name || "";
  const firstName = name.split(" ")[0] || "You";
  const initial = (firstName || "U").slice(0, 1).toUpperCase();
  const goal = data?.groupName || "—";
  const avatarUrl = data?.avatarUrl ?? null;

  const stat = (n: number) => (n > 0 ? String(n) : "—");

  return (
    <div
      className="min-h-[100dvh] w-full pb-28"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
      <header className="bg-white px-6 pt-5 pb-4">
        <div className="text-[24px] font-black tracking-tight">
          <span style={{ color: PURPLE }}>P</span>
          <span>actara</span>
        </div>
      </header>

      {/* Identity card */}
      <section className="bg-white px-6 py-5 flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={openPicker}
            aria-label="Change photo"
            className="h-20 w-20 rounded-full flex items-center justify-center text-white text-[32px] font-bold overflow-hidden"
            style={{ background: data?.avatarColor || PURPLE }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </button>
          <button
            type="button"
            onClick={openPicker}
            aria-label="Change photo"
            disabled={uploading}
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center shadow-sm disabled:opacity-60"
          >
            <Camera size={14} className="text-neutral-600" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[22px] font-bold truncate">{firstName}</div>
          <div className="text-[14px] text-neutral-500 truncate">{goal}</div>
        </div>
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className="px-3 py-2 rounded-full text-[13px] font-semibold disabled:opacity-60"
          style={{ background: PURPLE_SOFT, color: PURPLE }}
        >
          {uploading ? "Uploading…" : "Edit photo"}
        </button>
      </section>


      {/* Activity */}
      <section className="px-5 pt-5">
        <div className="text-[12px] font-semibold tracking-wider text-neutral-400 mb-3 px-1">
          ACTIVITY
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Flame size={18} style={{ color: PURPLE }} />} bg={PURPLE_SOFT} label="Day streak" value={stat(data?.currentStreak ?? 0)} />
          <StatCard icon={<CalendarDays size={18} style={{ color: PURPLE }} />} bg={PURPLE_SOFT} label="Total check-ins" value={stat(data?.totalCheckIns ?? 0)} />
          <StatCard icon={<Target size={18} style={{ color: "#16A34A" }} />} bg={GREEN_SOFT} label="Best streak" value={stat(data?.bestStreak ?? 0)} />
        </div>

        {/* Past 7 days */}
        <div className="mt-3 rounded-2xl bg-white p-5">
          <div className="text-[16px] font-bold">Past 7 days</div>
          <Past7Days days={data?.past7 ?? []} />

          <div className="mt-5 pt-4 border-t border-neutral-100">
            <div className="text-[12px] font-semibold tracking-wider text-neutral-400 mb-2">
              EARNED SO FAR
            </div>
            <div className="flex items-center gap-2 text-[14px] text-neutral-400">
              <Award size={16} />
              {(data?.bestStreak ?? 0) >= 3
                ? `${data?.bestStreak}-day streak badge earned.`
                : "Check in 3 days straight to earn your first badge."}
            </div>
          </div>
        </div>
      </section>

      {/* Settings */}
      <section className="px-5 pt-6">
        <div className="text-[12px] font-semibold tracking-wider text-neutral-400 mb-3 px-1">
          SETTINGS
        </div>

        <div className="rounded-2xl bg-white overflow-hidden">
          <Row
            icon={<Zap size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Plan"
            subtitle="Free trial · 7 days free, then $9.99/mo"
          />
          <div className="h-px bg-neutral-100 ml-[68px]" />
          <Row
            icon={<SlidersHorizontal size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Account settings"
            subtitle="Name, email, password, privacy"
            onClick={() => navigate({ to: "/account-settings" })}
          />

          <div className="h-px bg-neutral-100 ml-[68px]" />
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 px-4 py-4 text-left"
          >
            <span
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: RED_SOFT }}
            >
              <LogOut size={18} className="text-red-500" />
            </span>
            <span className="flex-1 text-[16px] font-semibold text-red-500">Sign out</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  bg,
  label,
  value,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 flex flex-col items-center text-center">
      <span
        className="h-9 w-9 rounded-xl flex items-center justify-center mb-2"
        style={{ background: bg }}
      >
        {icon}
      </span>
      <div className={`text-[22px] font-bold leading-tight ${value === "—" ? "text-neutral-300" : ""}`}>
        {value}
      </div>
      <div className="text-[12px] text-neutral-500 mt-1 leading-tight">{label}</div>
    </div>
  );
}

function Past7Days({ days }: { days: { date: string; checked: boolean }[] }) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const anyChecked = days.some((d) => d.checked);
  return (
    <div className="mt-4">
      <div className="flex items-end justify-between gap-2 h-20">
        {days.map((d, i) => {
          const dt = new Date(d.date + "T00:00:00Z");
          const dayLabel = labels[dt.getUTCDay()];
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full rounded-full"
                style={{
                  height: d.checked ? "56px" : "6px",
                  background: d.checked ? PURPLE : "#E5E5E5",
                }}
              />
              <div className="text-[11px] text-neutral-500">{dayLabel}</div>
            </div>
          );
        })}
      </div>
      {!anyChecked && (
        <div className="text-center text-[13px] text-neutral-400 mt-3">
          Check in once and this fills in.
        </div>
      )}
    </div>
  );
}

function Row({
  icon,
  iconBg,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 px-4 py-4 text-left">
      <span
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-bold text-neutral-900">{title}</span>
        <span className="block text-[13px] text-neutral-500 truncate">{subtitle}</span>
      </span>
      <ChevronRight size={20} className="text-neutral-300 shrink-0" />
    </button>
  );
}
