import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAccountSettings } from "@/lib/profile.functions";
import { SubPage, Field } from "@/components/account/SettingsKit";

export const Route = createFileRoute("/_authenticated/account-settings/email")({
  head: () => ({ meta: [{ title: 'Sign-in email · Pactara' }, { name: 'description', content: 'View your Pactara sign-in email.' }, { property: 'og:title', content: 'Sign-in email · Pactara' }, { property: 'og:description', content: 'View your Pactara sign-in email.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: EmailPage,
});

function EmailPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const { data } = useQuery({
    queryKey: ["account-settings"],
    queryFn: () => getAccountSettings(),
  });

  useEffect(() => {
    if (data) setEmail(data.email);
  }, [data]);

  return (
    <SubPage title="Email" onBack={() => navigate({ to: "/account-settings" })}>
      <p className="text-[13px] text-neutral-500 mb-3 px-1">
        Your sign-in email can't be changed. Contact support if you need help with your account.
      </p>
      <Field label="Email address">
        <input
          type="email"
          value={email}
          readOnly
          disabled
          className="w-full rounded-xl px-4 py-3 text-[15px] outline-none bg-[#EFEDEA] text-neutral-500 cursor-not-allowed"
        />
      </Field>
    </SubPage>
  );
}
