import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Mail,
  Lock,
  Bell,
  Trash2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/profile.functions";

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#EDE4FF";
const RED_SOFT = "#FEE2E2";
const BG = "#F5F2EE";
const LABEL = "#8A8580";

export const Route = createFileRoute("/_authenticated/account-settings/")({
  component: AccountSettingsHub,
});

function AccountSettingsHub() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const deleteFn = useServerFn(deleteMyAccount);
  const deleteAccount = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      navigate({ to: "/login", replace: true });
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <div
      className="min-h-[100dvh] w-full pb-28"
      style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="bg-white px-4 pt-5 pb-4 flex items-center gap-2">
        <button
          onClick={() => navigate({ to: "/profile" })}
          aria-label="Back"
          className="h-9 w-9 -ml-2 rounded-full flex items-center justify-center"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="text-[18px] font-bold">Account settings</div>
      </header>

      <section className="px-5 pt-5">
        <div
          className="text-[12px] font-semibold tracking-wider mb-3 px-1"
          style={{ color: LABEL }}
        >
          ACCOUNT
        </div>
        <div className="rounded-2xl bg-white overflow-hidden">
          <Row
            icon={<UserIcon size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Name"
            subtitle="How you appear in your group"
            onClick={() => navigate({ to: "/account-settings/name" })}
          />
          <Divider />
          <Row
            icon={<Mail size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Email"
            subtitle="Used to sign in"
            onClick={() => navigate({ to: "/account-settings/email" })}
          />
          <Divider />
          <Row
            icon={<Lock size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Password"
            subtitle="Change your password"
            onClick={() => navigate({ to: "/account-settings/password" })}
          />
        </div>
      </section>

      <section className="px-5 pt-6">
        <div
          className="text-[12px] font-semibold tracking-wider mb-3 px-1"
          style={{ color: LABEL }}
        >
          PREFERENCES
        </div>
        <div className="rounded-2xl bg-white overflow-hidden">
          <Row
            icon={<Bell size={18} style={{ color: PURPLE }} />}
            iconBg={PURPLE_SOFT}
            title="Notifications"
            subtitle="Push, email, reminders"
            onClick={() => navigate({ to: "/account-settings/notifications" })}
          />
        </div>
      </section>

      <section className="px-5 pt-6">
        <div
          className="text-[12px] font-semibold tracking-wider mb-3 px-1"
          style={{ color: LABEL }}
        >
          DANGER ZONE
        </div>
        <div className="rounded-2xl bg-white p-4">
          {err && (
            <div className="mb-3 rounded-xl px-3 py-2 text-[13px] bg-red-100 text-red-800">
              {err}
            </div>
          )}
          {!confirmDelete ? (
            <button
              onClick={() => {
                setErr(null);
                setConfirmDelete(true);
              }}
              className="w-full flex items-center gap-3 py-1 text-left"
            >
              <span
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: RED_SOFT }}
              >
                <Trash2 size={18} className="text-red-500" />
              </span>
              <span className="flex-1 text-[16px] font-semibold text-red-500">
                Delete account
              </span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="text-[14px] font-semibold text-red-600">
                Permanently delete your account? This can't be undone.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleteAccount.isPending}
                  className="flex-1 rounded-full bg-neutral-200 text-neutral-800 py-3 font-semibold text-[15px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteAccount.mutate()}
                  disabled={deleteAccount.isPending}
                  className="flex-1 rounded-full bg-red-600 text-white py-3 font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {deleteAccount.isPending && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  Yes, delete
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
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

function Divider() {
  return <div className="h-px bg-neutral-100 ml-[68px]" />;
}
