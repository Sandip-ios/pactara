import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAccountSettings } from "@/lib/profile.functions";
import { SubPage, Field, PrimaryButton, Flash, useFlash } from "@/components/account/SettingsKit";

export const Route = createFileRoute("/_authenticated/account-settings/email")({
  component: EmailPage,
});

function EmailPage() {
  const navigate = useNavigate();
  const { msg, flash } = useFlash();
  const [email, setEmail] = useState("");

  const { data } = useQuery({
    queryKey: ["account-settings"],
    queryFn: () => getAccountSettings(),
  });

  useEffect(() => {
    if (data) setEmail(data.email);
  }, [data]);

  const save = useMutation({
    mutationFn: async (newEmail: string) => {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
    },
    onSuccess: () => flash("ok", "Check your inbox to confirm the new email"),
    onError: (e: Error) => flash("err", e.message),
  });

  const changed = email.trim().length > 0 && email.trim() !== data?.email;

  return (
    <SubPage title="Email" onBack={() => navigate({ to: "/account-settings" })}>
      <Flash msg={msg} />
      <p className="text-[13px] text-neutral-500 mb-3 px-1">
        We'll send a confirmation link to your new address. The change takes effect once you
        confirm.
      </p>
      <Field label="Email address">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-[15px] outline-none bg-[#EFEDEA]"
          placeholder="you@example.com"
          autoComplete="email"
        />
      </Field>
      <PrimaryButton
        disabled={!changed || save.isPending}
        loading={save.isPending}
        onClick={() => save.mutate(email.trim())}
      >
        Update email
      </PrimaryButton>
    </SubPage>
  );
}
