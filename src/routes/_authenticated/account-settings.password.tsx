import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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

function PasswordPage() {
  const navigate = useNavigate();
  const { msg, flash } = useFlash();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const { data } = useQuery({
    queryKey: ["account-settings"],
    queryFn: () => getAccountSettings(),
  });

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

      // Re-authenticate to verify current password
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
      flash("ok", "Password updated");
    },
    onError: (e: Error) => flash("err", e.message),
  });

  const clearError = (key: keyof FieldErrors) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const canSubmit =
    current.length > 0 && next.length >= 8 && confirm.length >= 8 && !save.isPending;

  return (
    <SubPage title="Password" onBack={() => navigate({ to: "/account-settings" })}>
      <Flash msg={msg} />
      <Field label="Current password" error={errors.current}>
        <input
          type="password"
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value);
            clearError("current");
          }}
          className={`w-full rounded-xl px-4 py-3 text-[15px] outline-none bg-[#EFEDEA] ${
            errors.current ? "ring-2 ring-red-500" : ""
          }`}
          autoComplete="current-password"
          placeholder="Enter current password"
          aria-invalid={!!errors.current}
        />
      </Field>
      <Field label="New password" error={errors.next}>
        <input
          type="password"
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            clearError("next");
          }}
          className={`w-full rounded-xl px-4 py-3 text-[15px] outline-none bg-[#EFEDEA] ${
            errors.next ? "ring-2 ring-red-500" : ""
          }`}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          aria-invalid={!!errors.next}
        />
      </Field>
      <Field label="Confirm new password" error={errors.confirm}>
        <input
          type="password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            clearError("confirm");
          }}
          className={`w-full rounded-xl px-4 py-3 text-[15px] outline-none bg-[#EFEDEA] ${
            errors.confirm ? "ring-2 ring-red-500" : ""
          }`}
          autoComplete="new-password"
          placeholder="Re-enter new password"
          aria-invalid={!!errors.confirm}
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
