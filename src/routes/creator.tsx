import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, Check, MousePointerClick, Smartphone, UserPlus, Flame, Crown, ShieldCheck } from "lucide-react";
import { getCreatorStats } from "@/lib/referral.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/creator")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Creator Dashboard · Pactara" },
      { name: "description", content: "Track the people your Pactara link brings in." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Creator Dashboard · Pactara" },
      { property: "og:description", content: "Track the people your Pactara link brings in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatorPage,
});

const STORE = "pactara-creator-key";
const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function money(c: number) {
  return `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CreatorPage() {
  const [key, setKey] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const k = url.searchParams.get("key");
    if (k) {
      localStorage.setItem(STORE, k);
      url.searchParams.delete("key");
      window.history.replaceState({}, "", url.toString());
      setKey(k);
    } else setKey(localStorage.getItem(STORE) ?? "");
  }, []);

  const q = useQuery({
    queryKey: ["creator", key, days],
    enabled: !!key,
    retry: false,
    queryFn: () => getCreatorStats({ data: { key: key!, days } }),
  });

  if (key === "" || q.isError)
    return (
      <Center>
        <ShieldCheck className="mx-auto size-8 text-pactara-purple" />
        <h1 className="mt-4 text-xl font-black">Private dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Open this page with your private link.</p>
      </Center>
    );
  if (!q.data) return <Center><p className="text-sm text-muted-foreground">Loading your numbers…</p></Center>;

  const d = q.data;
  const t = d.totals;
  const max = Math.max(1, ...d.series.map((s) => s.taps));
  const funnel = [
    { label: "Link taps", value: t.taps, icon: MousePointerClick },
    { label: "App Store visits", value: t.store, icon: Smartphone },
    { label: "Sign-ups", value: t.signups, icon: UserPlus },
    { label: "Checking in", value: t.active, icon: Flame },
    { label: "Paying members", value: t.paying, icon: Crown },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-5 pb-20 pt-8 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-pactara-purple">Pactara creator</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Hey {d.name} 👋</h1>
            <p className="mt-1 text-sm text-muted-foreground">Here's who your link brought to Pactara.</p>
          </div>
          <div className="flex gap-1 rounded-full bg-muted p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                  days === r.days ? "bg-pactara-purple text-pactara-purple-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-pactara-purple p-6 text-pactara-purple-foreground md:col-span-2">
            <p className="text-sm font-semibold opacity-80">Total earned</p>
            <p className="mt-1 text-5xl font-black tracking-tight">{money(d.lifetime.earnedCents)}</p>
            <p className="mt-2 text-sm opacity-80">
              {d.lifetime.paying} paying member{d.lifetime.paying === 1 ? "" : "s"} · {money(d.payoutCents)} each · {d.lifetime.members} joined all-time
            </p>
          </div>
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <p className="text-sm font-semibold text-muted-foreground">Your link</p>
            <p className="mt-2 break-all text-lg font-black">{d.link}</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://${d.link}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="mt-4 flex items-center gap-2 rounded-full bg-pactara-purple-soft px-4 py-2 text-sm font-bold text-pactara-purple"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {funnel.map((f, i) => {
            const prev = i ? funnel[i - 1].value : 0;
            const rate = i && prev ? Math.round((f.value / prev) * 100) : null;
            return (
              <div key={f.label} className="rounded-2xl border border-border/60 bg-card p-4">
                <f.icon className="size-4 text-pactara-purple" />
                <p className="mt-3 text-3xl font-black tracking-tight">{f.value.toLocaleString()}</p>
                <p className="text-xs font-semibold text-muted-foreground">{f.label}</p>
                {rate !== null && <p className="mt-1 text-xs font-bold text-pactara-purple">{rate}% of previous</p>}
              </div>
            );
          })}
        </section>

        <section className="mt-4 rounded-3xl border border-border/60 bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-black">Taps & sign-ups</h2>
            <div className="flex gap-4 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-pactara-purple-soft" />Taps</span>
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-pactara-purple" />Sign-ups</span>
            </div>
          </div>
          <div className="mt-6 flex h-44 items-end gap-[3px]">
            {d.series.map((s) => (
              <div key={s.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${s.date}: ${s.taps} taps, ${s.signups} sign-ups`}>
                <div className="relative w-full rounded-t-md bg-pactara-purple-soft" style={{ height: `${(s.taps / max) * 100}%`, minHeight: 2 }}>
                  {s.signups > 0 && (
                    <div className="absolute bottom-0 w-full rounded-t-md bg-pactara-purple" style={{ height: `${Math.min(100, (s.signups / Math.max(1, s.taps)) * 100)}%`, minHeight: 4 }} />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{d.series[0]?.date}</span>
            <span>Today</span>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-border/60 bg-card p-6">
          <h2 className="font-black">Recent members</h2>
          {d.recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No sign-ups yet. Share your link and they'll show up here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/60">
              {d.recent.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-pactara-purple-soft text-sm font-black text-pactara-purple">
                      {r.name[0]}
                    </span>
                    <div>
                      <p className="text-sm font-bold">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.joined ? new Date(r.joined).toLocaleDateString() : ""}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-bold", r.status === "Paying" ? "bg-pactara-purple text-pactara-purple-foreground" : "bg-muted text-muted-foreground")}>
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="mt-6 text-center text-xs text-muted-foreground">Only first names are shown. Sign-ups are matched to your link when the app is installed within 24 hours of a tap.</p>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-background px-6 text-center"><div className="max-w-sm">{children}</div></div>;
}
