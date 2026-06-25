import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { getAccountSettings, updateProfileName } from "@/lib/profile.functions";
import { SubPage, Field, PrimaryButton, Flash, useFlash } from "@/components/account/SettingsKit";

export const Route = createFileRoute("/_authenticated/account-settings/name")({
  component: NamePage,
});

function NamePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { msg, flash } = useFlash();
  const [name, setName] = useState("");

  const { data } = useQuery({
    queryKey: ["account-settings"],
    queryFn: () => getAccountSettings(),
  });

  useEffect(() => {
    if (data) setName(data.name);
  }, [data]);

  const saveFn = useServerFn(updateProfileName);
  const save = useMutation({
    mutationFn: (n: string) => saveFn({ data: { name: n } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-settings"] });
      queryClient.invalidateQueries({ queryKey: ["profile-overview"] });
      queryClient.invalidateQueries({ queryKey: ["my-group-status"] });
      flash("ok", "Name updated");
    },
    onError: (e: Error) => flash("err", e.message),
  });

  const changed = name.trim().length > 0 && name.trim() !== data?.name;

  return (
    <SubPage title="Name" onBack={() => navigate({ to: "/account-settings" })}>
      <Flash msg={msg} />
      <Field label="Display name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-[15px] outline-none bg-[#EFEDEA]"
          placeholder="Your name"
        />
      </Field>
      <PrimaryButton
        disabled={!changed || save.isPending}
        loading={save.isPending}
        onClick={() => save.mutate(name.trim())}
      >
        Save name {save.isPending && <Loader2 size={16} className="animate-spin ml-1" />}
      </PrimaryButton>
    </SubPage>
  );
}
