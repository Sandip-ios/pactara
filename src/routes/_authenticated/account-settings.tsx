import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getAccountSettings,
  updateProfileName,
  deleteMyAccount,
} from "@/lib/profile.functions";

const PURPLE = "#7C3AED";
const BG = "#F5F2EE";
const INPUT_BG = "#EFEDEA";
const LABEL = "#8A8580";

export const Route = createFileRoute("/_authenticated/account-settings")({
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["account-settings"],
    queryFn: () => getAccountSettings(),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (data) {
      setName(data.name);
      setEmail(data.email);
    }
  }, [data]);

  const flash = (kind: "ok" | "err", text: string) => {
    setMsg({ kind, text });
    window.setTimeout(() => setMsg(null), 3000);
  };

  const saveNameFn = useServerFn(updateProfileName);
  const saveName = useMutation({
    mutationFn: (n: string) => saveNameFn({ data: { name: n } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
      queryClient.invalidateQueries({ queryKey: ["profile-overview"] });
      queryClient.invalidateQueries({ queryKey: ["my-group-status"] });
      flash("ok", "Name updated");
    },
    onError: (e: Error) => flash("err", e.message),
  });

  const saveEmail = useMutation({
    mutationFn: async (newEmail: string) => {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
    },
    onSuccess: () => flash("ok", "Check your inbox to confirm the new email"),
    onError: (e: Error) => flash("err", e.message),
  });

  const savePassword = useMutation({
    mutationFn: async (newPw: string) => {
      if (newPw.length < 8) throw new Error("Password must be at least 8 characters");
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
    },
    onSuccess: () => {
      setPassword("");
      flash("ok", "Password updated");
    },
    onError: (e: Error) => flash("err", e.message),
  });

  const deleteFn = useServerFn(deleteMyAccount);
  const deleteAccount = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      navigate({ to: "/login", replace: true });
    },
    onError: (e: Error) => flash("err", e.message),
  });

  const nameChanged = name.trim().length > 0 && name.trim() !== data?.name;
  const emailChanged = email.trim().length > 0 && email.trim() !== data?.email;

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

      {msg && (
        <div
          className={`mx-4 mt-3 rounded-xl px-4 py-3 text-[14px] font-medium ${
            msg.kind === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Name */}
      <Section title="NAME">
        <Field label="Display name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-[15px] outline-none"
            style={{ background: INPUT_BG }}
            placeholder="Your name"
          />
        </Field>
        <PrimaryButton
          disabled={!nameChanged || saveName.isPending}
          loading={saveName.isPending}
          onClick={() => saveName.mutate(name.trim())}
        >
          Save name
        </PrimaryButton>
      </Section>

      {/* Email */}
      <Section title="EMAIL">
        <Field label="Email address">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-[15px] outline-none"
            style={{ background: INPUT_BG }}
            placeholder="you@example.com"
          />
        </Field>
        <PrimaryButton
          disabled={!emailChanged || saveEmail.isPending}
          loading={saveEmail.isPending}
          onClick={() => saveEmail.mutate(email.trim())}
        >
          Update email
        </PrimaryButton>
      </Section>

      {/* Password */}
      <Section title="PASSWORD">
        <Field label="New password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-[15px] outline-none"
            style={{ background: INPUT_BG }}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </Field>
        <PrimaryButton
          disabled={password.length < 8 || savePassword.isPending}
          loading={savePassword.isPending}
          onClick={() => savePassword.mutate(password)}
        >
          Change password
        </PrimaryButton>
      </Section>

      {/* Danger zone */}
      <Section title="DANGER ZONE">
        <p className="text-[13px] text-neutral-500 mb-3 px-1">
          Deleting your account is permanent. Your check-ins, posts, and group memberships
          will be removed.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full rounded-full bg-red-50 text-red-600 py-3 font-semibold text-[15px]"
          >
            Delete account
          </button>
        ) : (
          <div className="space-y-2">
            <div className="text-[14px] font-semibold text-red-600 px-1">
              Are you sure? This can't be undone.
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
                {deleteAccount.isPending && <Loader2 size={16} className="animate-spin" />}
                Yes, delete
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 pt-6">
      <div
        className="text-[12px] font-semibold tracking-wider mb-3 px-1"
        style={{ color: LABEL }}
      >
        {title}
      </div>
      <div className="rounded-2xl bg-white p-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium mb-1.5" style={{ color: LABEL }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function PrimaryButton({
  disabled,
  loading,
  onClick,
  children,
}: {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full py-3 text-white text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      style={{ background: PURPLE }}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
