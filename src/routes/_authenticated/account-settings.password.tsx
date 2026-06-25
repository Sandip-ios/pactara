import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAccountSettings } from "@/lib/profile.functions";
import { SubPage, Field, PrimaryButton, Flash, useFlash } from "@/components/account/SettingsKit";

export const Route = createFileRoute("/_authenticated/account-settings/password")({
  component: PasswordPage,
});

type FieldErrors = {
  current?: string;
  next?: string;
  confirm?: string;
};

type Visible = { current: boolean; next: boolean; confirm: boolean };

function PasswordPage() {
  const navigate = useNavigate();
  const { msg, flash } = useFlash();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [visible, setVisible] = useState<Visible>({
    current: false,
    next: false,
    confirm: false,
  });
  const [verifying, setVerifying] = useState(false);
  const verifiedRef = useRef<{ value: string; ok: boolean } | null>(null);

  const { data } = useQuery({
    queryKey: ["account-settings"],
    queryFn: () => getAccountSettings(),
  });

  const verifyCurrent = async () => {
    const pw = current;
    if (!pw || !data?.email) return;
    // skip if we've already verified this exact value
    if (verifiedRef.current && verifiedRef.current.value === pw) {
      if (!verifiedRef.current.ok)
        setErrors((p) => ({ ...p, current: "Current password is incorrect" }));
      return;
    }
    setVerifying(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: pw,
    });
    setVerifying(false);
    verifiedRef.current = { value: pw, ok: !error };
    if (error) {
      setErrors((p) => ({ ...p, current: "Current password is incorrect" }));
    } else {
      setErrors((p) => ({ ...p, current: undefined }));
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const e: FieldErrors = {};
      if (!current) e.current = "Enter your current password";
      if (next.length < 8) e.next = "Must be at least 8 characters";
      if (next && confirm && next !== confirm) e.confirm = "Passwords don't match";
      if (next && current && next === current)
        e.next = "New password must be different from current";
      if (Object.keys(e).length > 0) {
        setErrors(e);
        throw new Error("Please fix the highlighted fields");
      }
      if (!data?.email) throw new Error("Couldn't load your account email");

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: current,
      });
      if (signInErr) {
        setErrors({ current: "Current password is incorrect" });
        throw new Error("Current password is incorrect");
      }

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
    },
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      setErrors({});
      setVisible({ current: false, next: false, confirm: false });
      verifiedRef.current = null;
      flash("ok", "Password updated");
    },
    onError: (e: Error) => flash("err", e.message),
  });

  const clearError = (key: keyof FieldErrors) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const toggle = (key: keyof Visible) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));

  const canSubmit =
    current.length > 0 && next.length >= 8 && confirm.length >= 8 && !save.isPending;

  return (
    <SubPage title="Password" onBack={() => navigate({ to: "/account-settings" })}>
      <Flash msg={msg} />

      <Field
        label="Current password"
        error={errors.current}
        hint={verifying ? "Checking…" : undefined}
      >
        <PasswordInput
          value={current}
          onChange={(v) => {
            setCurrent(v);
            clearError("current");
          }}
          onBlur={verifyCurrent}
          visible={visible.current}
          onToggle={() => toggle("current")}
          invalid={!!errors.current}
          autoComplete="current-password"
          placeholder="Enter current password"
        />
      </Field>

      <Field label="New password" error={errors.next}>
        <PasswordInput
          value={next}
          onChange={(v) => {
            setNext(v);
            clearError("next");
          }}
          visible={visible.next}
          onToggle={() => toggle("next")}
          invalid={!!errors.next}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </Field>

      <Field label="Confirm new password" error={errors.confirm}>
        <PasswordInput
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            clearError("confirm");
          }}
          onBlur={() => {
            if (confirm && next && confirm !== next) {
              setErrors((p) => ({ ...p, confirm: "Passwords don't match" }));
            }
          }}
          visible={visible.confirm}
          onToggle={() => toggle("confirm")}
          invalid={!!errors.confirm}
          autoComplete="new-password"
          placeholder="Re-enter new password"
        />
      </Field>


      <PrimaryButton
        disabled={!canSubmit}
        loading={save.isPending}
        onClick={() => save.mutate()}
      >
        Change password
      </PrimaryButton>
    </SubPage>
  );
}

function PasswordInput({
  value,
  onChange,
  onBlur,
  visible,
  onToggle,
  invalid,
  autoComplete,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  visible: boolean;
  onToggle: () => void;
  invalid: boolean;
  autoComplete: string;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full rounded-xl pl-4 pr-12 py-3 text-[15px] outline-none bg-[#EFEDEA] ${
          invalid ? "ring-2 ring-red-500" : ""
        }`}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute top-1/2 right-2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-800"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
