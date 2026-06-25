import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAccountSettings } from "@/lib/profile.functions";
import { SubPage, Field, PrimaryButton, Flash, useFlash } from "@/components/account/SettingsKit";

export const Route = createFileRoute("/_authenticated/account-settings/password")({
  component: PasswordPage,
});

function PasswordPage() {
  const navigate = useNavigate();
  const { msg, flash } = useFlash();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const { data } = useQuery({
    queryKey: ["account-settings"],
    queryFn: () => getAccountSettings(),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Enter your current password");
      if (next.length < 8) throw new Error("New password must be at least 8 characters");
      if (next !== confirm) throw new Error("New passwords don't match");
      if (next === current) throw new Error("New password must be different");
      if (!data?.email) throw new Error("Couldn't load your account email");

      // Re-authenticate to verify current password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: current,
      });
      if (signInErr) throw new Error("Current password is incorrect");

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
    },
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      flash("ok", "Password updated");
    },
    onError: (e: Error) => flash("err", e.message),
  });

  const canSubmit =
    current.length > 0 && next.length >= 8 && confirm.length >= 8 && !save.isPending;

  return (
    <SubPage title="Password" onBack={() => navigate({ to: "/account-settings" })}>
      <Flash msg={msg} />
      <Field label="Current password">
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-[15px] outline-none bg-[#EFEDEA]"
          autoComplete="current-password"
          placeholder="Enter current password"
        />
      </Field>
      <Field label="New password">
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-[15px] outline-none bg-[#EFEDEA]"
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </Field>
      <Field label="Confirm new password">
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-[15px] outline-none bg-[#EFEDEA]"
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
