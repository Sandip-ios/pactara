import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from "@/lib/profile.functions";
import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
} from "@/lib/push.functions";
import {
  enablePush,
  disablePush,
  pushSupported,
  previewBlocked,
} from "@/lib/push-client";
import { SubPage, Flash, useFlash } from "@/components/account/SettingsKit";

const PURPLE = "#7C3AED";
const LABEL = "#8A8580";

export const Route = createFileRoute("/_authenticated/account-settings/notifications")({
  component: NotificationsPage,
});

type Prefs = {
  push_enabled: boolean;
  email_enabled: boolean;
  daily_reminder_enabled: boolean;
  daily_reminder_time: string;
  group_activity_enabled: boolean;
  morning_ritual_reminder_enabled: boolean;
};

function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { msg, flash } = useFlash();

  const { data } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => getNotificationPrefs(),
  });

  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => {
    if (data) setPrefs(data);
  }, [data]);

  const updateFn = useServerFn(updateNotificationPrefs);
  const getKeyFn = useServerFn(getVapidPublicKey);
  const saveSubFn = useServerFn(savePushSubscription);
  const deleteSubFn = useServerFn(deletePushSubscription);

  const save = useMutation({
    mutationFn: (patch: Partial<Prefs>) => updateFn({ data: patch }),
    onMutate: (patch) => {
      setPrefs((p) => (p ? { ...p, ...patch } : p));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: (e: Error) => {
      flash("err", e.message);
      queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
  });

  const morningToggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) {
        if (!pushSupported()) {
          throw new Error("Your browser doesn't support push notifications");
        }
        if (previewBlocked()) {
          throw new Error("Push only works on the published app, not the preview");
        }
        const { publicKey } = await getKeyFn();
        const result = await enablePush(publicKey);
        if (!result.ok) {
          if (result.reason === "denied")
            throw new Error("Notification permission denied");
          if (result.reason === "preview")
            throw new Error("Push only works on the published app");
          if (result.reason === "unsupported")
            throw new Error("Your browser doesn't support push notifications");
          if (result.reason === "no-key")
            throw new Error("Push isn't configured yet");
          throw new Error(result.message || "Couldn't enable push");
        }
        const sub = result.subscription;
        await saveSubFn({
          data: {
            endpoint: sub.endpoint!,
            keys: {
              p256dh: sub.keys!.p256dh!,
              auth: sub.keys!.auth!,
            },
            userAgent: navigator.userAgent,
          },
        });
        await updateFn({
          data: { morning_ritual_reminder_enabled: true, push_enabled: true },
        });
      } else {
        const removed = await disablePush();
        if (removed?.endpoint) {
          await deleteSubFn({ data: { endpoint: removed.endpoint } });
        }
        await updateFn({
          data: { morning_ritual_reminder_enabled: false },
        });
      }
      return next;
    },
    onMutate: (next) => {
      setPrefs((p) => (p ? { ...p, morning_ritual_reminder_enabled: next } : p));
    },
    onSuccess: (next) => {
      flash("ok", next ? "Commitment reminder on" : "Reminder turned off");
      queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: (e: Error) => {
      flash("err", e.message);
      queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
  });

  if (!prefs) {
    return (
      <SubPage title="Notifications" onBack={() => navigate({ to: "/account-settings" })}>
        <div className="text-[14px] text-neutral-500">Loading…</div>
      </SubPage>
    );
  }

  return (
    <SubPage title="Notifications" onBack={() => navigate({ to: "/account-settings" })}>
      <Flash msg={msg} />

      <SectionLabel>CHANNELS</SectionLabel>
      <Card>
        <ToggleRow
          title="Push notifications"
          subtitle="Alerts on this device"
          value={prefs.push_enabled}
          onChange={(v) => save.mutate({ push_enabled: v })}
        />
      </Card>

      <SectionLabel>TODAY'S COMMITMENT</SectionLabel>
      <Card>
        <ToggleRow
          title="Commitment reminder"
          subtitle="A push at 10am in your local timezone"
          value={prefs.morning_ritual_reminder_enabled}
          disabled={morningToggle.isPending}
          onChange={(v) => morningToggle.mutate(v)}
        />
      </Card>

      <SectionLabel>DAILY CHECK-IN REMINDER</SectionLabel>
      <Card>
        <ToggleRow
          title="Remind me to check in"
          subtitle="A reminder so you don't miss a day"
          value={prefs.daily_reminder_enabled}
          onChange={(v) => save.mutate({ daily_reminder_enabled: v })}
        />
        {prefs.daily_reminder_enabled && (
          <>
            <Divider />
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-[15px] font-semibold">Reminder time</div>
                <div className="text-[13px] text-neutral-500">In your local timezone</div>
              </div>
              <input
                type="time"
                value={prefs.daily_reminder_time}
                onChange={(e) =>
                  save.mutate({ daily_reminder_time: e.target.value })
                }
                className="rounded-lg bg-[#EFEDEA] px-3 py-2 text-[15px] outline-none"
              />
            </div>
          </>
        )}
      </Card>

      <SectionLabel>GROUP ACTIVITY</SectionLabel>
      <Card>
        <ToggleRow
          title="Group activity alerts"
          subtitle="New check-ins, thoughts, and messages"
          value={prefs.group_activity_enabled}
          onChange={(v) => save.mutate({ group_activity_enabled: v })}
        />
      </Card>

      <p className="text-[12px] text-neutral-400 mt-4 px-1">
        Changes save automatically.
      </p>
    </SubPage>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[12px] font-semibold tracking-wider mt-5 mb-2 px-1"
      style={{ color: LABEL }}
    >
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white overflow-hidden">{children}</div>;
}

function Divider() {
  return <div className="h-px bg-neutral-100 mx-4" />;
}

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between px-4 py-3 text-left disabled:opacity-60"
    >
      <div className="min-w-0 pr-3">
        <div className="text-[15px] font-semibold">{title}</div>
        {subtitle && <div className="text-[13px] text-neutral-500">{subtitle}</div>}
      </div>
      <span
        className="relative h-7 w-12 rounded-full transition-colors shrink-0"
        style={{ background: value ? PURPLE : "#D6D3D1" }}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all"
          style={{ left: value ? "22px" : "2px" }}
        />
      </span>
    </button>
  );
}
