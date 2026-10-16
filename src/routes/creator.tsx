import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, ArrowDown, MousePointerClick, Smartphone, UserPlus, Flame, Crown, ShieldCheck, Plus, Minus, Download } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { getCreatorStats, saveCreatorFollowers } from "@/lib/referral.functions";
import { RATE, PRICE, STORE_FEE, CUT, PLAN_MONTHS, PLAN_CHURN } from "@/lib/creator-payout";
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
const RANGES = [7, 30, 90];
const card = "rounded-[18px] border border-cr-line bg-cr-surface";
const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.09em]";
const display = "font-cr-display tracking-[-0.035em]";

const usd = (n: number) =>
  "$" + n.toLocaleString("en-US", n >= 1000 ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd2 = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (n: number) => Math.round(n).toLocaleString("en-US");
const shortDate = (d: Date | string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const short = (n: number) => (n >= 1000 ? `$${+(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);
function nice(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
function scrollKit() {
  document.getElementById("kit")?.scrollIntoView({ behavior: "smooth" });
}
function copy(text: string, msg: string) {
  navigator.clipboard.writeText(text);
  toast(msg, { position: "bottom-center", style: { background: "var(--cr-ink)", color: "var(--cr-bg)", borderRadius: 999, border: "none", width: "auto", left: "50%", transform: "translateX(-50%)" } });
}

function useCount(target: number) {
  const [v, setV] = useState(target);
  const first = useRef(true);
  const from = useRef(target);
  useEffect(() => {
    if (first.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      first.current = false;
      from.current = target;
      setV(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 450);
      const val = a + (target - a) * (1 - (1 - k) ** 3);
      from.current = val;
      setV(val);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

function CreatorPage() {
  const [key, setKey] = useState<string | null>(null);
  const [days, setDays] = useState(30);

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
    placeholderData: (p) => p,
    queryFn: () => getCreatorStats({ data: { key: key!, days } }),
  });

  if (key === "" || q.isError)
    return (
      <Center>
        <ShieldCheck className="mx-auto size-8 text-cr-accent" />
        <h1 className={cn("mt-4 text-xl font-extrabold", display)}>Private dashboard</h1>
        <p className="mt-2 text-sm text-cr-muted">Open this page with your private link.</p>
      </Center>
    );
  if (!q.data) return <Center><p className="text-sm text-cr-muted">Loading your numbers…</p></Center>;

  const d = q.data;
  const link = `https://${d.link}`;
  const first = d.name.split(" ")[0];
  const paying = d.lifetime.paying;
  const monthly = paying * RATE;

  return (
    <div className="creator min-h-screen bg-cr-bg text-cr-ink">
      <div className="mx-auto max-w-[1120px] space-y-5 px-4 pb-16 pt-6">
        <div className="flex items-center gap-2.5">
          <span className={cn("grid size-7 place-items-center rounded-lg bg-cr-accent text-sm font-extrabold text-cr-accent-ink", display)}>P</span>
          <span className={cn("font-bold", display)}>Pactara</span>
          <span className={cn("rounded-full bg-cr-accent-soft px-2 py-0.5 text-cr-accent", eyebrow)}>Creator</span>
        </div>

        <section className="grid grid-cols-1 items-end gap-5 min-[901px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="text-cr-muted">Hey {first} 👋</p>
            <h1 className={cn("mt-1 text-[34px] font-extrabold leading-[1.02] min-[901px]:text-[58px]", display)}>
              You're earning <span className={monthly > 0 ? "text-cr-accent" : "text-cr-faint"}>{usd2(monthly)}</span> a month
            </h1>
            <p className="mt-3 text-sm text-cr-muted">
              {paying > 0 ? (
                <><b className="text-cr-ink">{int(paying)}</b> paying members · <b className="text-cr-ink">{usd2(RATE)}</b> each, every month · <b className="text-cr-ink">{int(d.lifetime.members)}</b> joined all-time</>
              ) : (
                <>Each paying member you bring in adds <b className="text-cr-ink">{usd2(RATE)}</b> to this, every month.</>
              )}
            </p>
          </div>
          <div className={cn(card, "min-w-0 p-5")}>
            <p className={cn(eyebrow, "text-cr-muted")}>Your link</p>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <div className="truncate rounded-xl bg-cr-sunk px-3 py-2.5 font-cr-mono text-sm">{d.link}</div>
              <button onClick={() => copy(link, "Link copied")} className="flex items-center gap-1.5 rounded-xl bg-cr-ink px-4 text-sm font-semibold text-cr-bg">
                <Copy className="size-4" /> Copy
              </button>
            </div>
            <button onClick={scrollKit} className="mt-3 flex items-center gap-1 text-sm font-semibold text-cr-accent">
              Get ready-to-post captions and a story card <ArrowDown className="size-3.5" />
            </button>
          </div>
        </section>

        <Planner keyStr={key!} initial={d.followers} />
        <ShareKit link={d.link} />

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className={cn("text-xl font-bold", display)}>Your link so far</h2>
              <p className="text-sm text-cr-muted">Real activity from people who tapped your link.</p>
            </div>
            <Segmented options={RANGES.map((r) => ({ v: r, label: `${r} days` }))} value={days} onChange={setDays} />
          </div>
          <Funnel t={d.totals} />
          <div className="mt-5 grid grid-cols-1 gap-5 min-[901px]:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <TapsChart series={d.series} />
            <Recent recent={d.recent} />
          </div>
        </section>

        <section className={cn(card, "grid grid-cols-1 divide-y divide-cr-line min-[901px]:grid-cols-3 min-[901px]:divide-x min-[901px]:divide-y-0")}>
          {[
            ["Share your link", "Put it in your bio, stories and captions. Every tap is counted here."],
            ["They join Pactara", "When someone installs the app within 24 hours of tapping, they're matched to you."],
            ["You get paid monthly", `You get ${usd2(RATE)} every month for each member who keeps their subscription.`],
          ].map(([t, s], i) => (
            <div key={t} className="p-5">
              <p className="font-cr-mono text-xs text-cr-accent">STEP {i + 1}</p>
              <p className="mt-2 font-bold">{t}</p>
              <p className="mt-1 text-sm text-cr-muted">{s}</p>
            </div>
          ))}
        </section>
        <p className="text-center text-[12.5px] text-cr-faint">Only first names are shown. Planner figures are estimates, not a promise of earnings.</p>
      </div>
    </div>
  );
}

function Segmented<T extends number>({ options, value, onChange, full }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; full?: boolean }) {
  return (
    <div className={cn("flex gap-1 rounded-xl bg-cr-sunk p-1", full && "w-full")}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", full && "flex-1", value === o.v ? "bg-cr-surface font-semibold text-cr-ink" : "text-cr-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Planner({ keyStr, initial }: { keyStr: string; initial: { instagram: number; tiktok: number } }) {
  const [ig, setIg] = useState(initial.instagram);
  const [tt, setTt] = useState(initial.tiktok);
  const [rate, setRate] = useState(0.01);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const saved = useRef(false);

  useEffect(() => {
    if (!saved.current) { saved.current = true; return; }
    const t = setTimeout(() => saveCreatorFollowers({ data: { key: keyStr, instagram: ig, tiktok: tt } }).catch(() => {}), 700);
    return () => clearTimeout(t);
  }, [ig, tt, keyStr]);

  const followers = ig + tt;
  const proj = useMemo(() => {
    const total = followers * rate;
    const perMonth = total / PLAN_MONTHS;
    let active = 0, yearOne = 0;
    const months: { date: Date; active: number; income: number }[] = [];
    const now = new Date();
    for (let m = 1; m <= PLAN_MONTHS; m++) {
      active = active * (1 - PLAN_CHURN) + perMonth;
      const income = active * RATE;
      yearOne += income;
      months.push({ date: new Date(now.getFullYear(), now.getMonth() + m, 1), active, income });
    }
    return { total, months, yearOne };
  }, [followers, rate]);
  const last = proj.months[PLAN_MONTHS - 1];
  const head = useCount(last.income);
  const yr = useCount(proj.yearOne);
  const mem = useCount(last.active);
  const max = nice(last.income);

  const row = (badge: string, cls: string, val: number, set: (n: number) => void, name: string) => (
    <label className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-cr-sunk px-3 py-2.5">
      <span className={cn("grid size-[26px] place-items-center rounded-md text-[10px] font-bold", cls)}>{badge}</span>
      <input
        inputMode="numeric"
        aria-label={`${name} followers`}
        value={val.toLocaleString("en-US")}
        onChange={(e) => set(Math.min(1e9, Number(e.target.value.replace(/\D/g, "")) || 0))}
        className={cn("w-full min-w-0 bg-transparent text-xl font-bold outline-none", display)}
      />
      <span className="text-sm text-cr-muted">{name}</span>
    </label>
  );

  return (
    <section className={cn(card, "grid grid-cols-1 min-[901px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]")}>
      <div className="min-w-0 border-b border-cr-line p-5 min-[901px]:border-b-0 min-[901px]:border-r">
        <p className={cn(eyebrow, "text-cr-accent")}>Earnings planner</p>
        <h2 className={cn("mt-1 text-xl font-bold", display)}>What could your link earn?</h2>
        <p className="mt-5 text-sm font-semibold">Your followers</p>
        {row("IG", "bg-cr-accent text-cr-accent-ink", ig, setIg, "Instagram")}
        {row("TT", "bg-cr-ink text-cr-bg", tt, setTt, "TikTok")}
        <p className="mt-2 text-xs text-cr-muted">Total audience <b className="text-cr-ink">{int(followers)}</b></p>
        <p className="mt-5 text-sm font-semibold">How many might subscribe?</p>
        <div className="mt-2">
          <Segmented full options={[{ v: 0.005, label: "0.5%" }, { v: 0.01, label: "1%" }, { v: 0.02, label: "2%" }]} value={rate} onChange={setRate} />
        </div>
        <p className="mt-4 rounded-xl bg-cr-accent-soft p-3 text-sm text-cr-muted">
          That's about <b className="text-cr-accent">{int(proj.total)} people</b> subscribing over the next year, each adding <b className="text-cr-accent">{usd2(RATE)}</b> to your monthly income.
        </p>
      </div>
      <div className="min-w-0 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={cn(eyebrow, "text-cr-muted")}>Monthly income by {last.date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</p>
            <p className={cn("mt-1 text-[48px] font-extrabold leading-none text-cr-accent min-[901px]:text-[76px]", display)}>
              {usd(head)}<span className="text-2xl text-cr-muted">/mo</span>
            </p>
          </div>
          <div className="flex gap-6">
            <div><p className={cn("text-lg font-bold", display)}>{usd(yr)}</p><p className="text-xs text-cr-muted">earned in year one</p></div>
            <div><p className={cn("text-lg font-bold", display)}>{int(mem)}</p><p className="text-xs text-cr-muted">paying members</p></div>
          </div>
        </div>
        <div className="relative mt-6 h-48 pl-10">
          {[1, 0.5, 0].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-dashed border-cr-line" style={{ top: `${(1 - f) * 100}%` }}>
              <span className="absolute -top-2 left-0 text-[11px] text-cr-faint">{short(max * f)}</span>
            </div>
          ))}
          <div className="relative flex h-full items-end gap-1.5 sm:gap-3">
            {proj.months.map((m, i) => (
              <div key={i} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {i === PLAN_MONTHS - 1 && (
                  <span className="absolute left-1/2 -translate-x-1/2 text-[11px] font-semibold text-cr-accent" style={{ bottom: `calc(${(m.income / max) * 100}% + 4px)` }}>{short(m.income)}</span>
                )}
                <div className={cn("w-full rounded-[5px]", i === PLAN_MONTHS - 1 ? "bg-cr-accent" : "bg-cr-accent-mid")} style={{ height: `${(m.income / max) * 100}%`, minHeight: 2 }} />
                {hover === i && (
                  <div className="absolute bottom-full left-1/2 z-10 mb-6 -translate-x-1/2 whitespace-nowrap rounded-lg bg-cr-ink px-2.5 py-1.5 text-xs text-cr-bg">
                    {m.date.toLocaleDateString("en-US", { month: "long", year: "numeric" })} · {usd2(m.income)}/mo · {int(m.active)} members
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-1.5 pl-10 sm:gap-3">
          {proj.months.map((m, i) => (
            <span key={i} className={cn("flex-1 text-center text-[11px]", i === PLAN_MONTHS - 1 ? "font-semibold text-cr-ink" : "text-cr-faint")}>
              {m.date.toLocaleDateString("en-US", { month: "short" })}
            </span>
          ))}
        </div>
        <div className="mt-5 border-t border-cr-line pt-4">
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-4 place-items-center rounded-full bg-cr-sunk">{open ? <Minus className="size-3" /> : <Plus className="size-3" />}</span>
            How we calculate this
          </button>
          {open && (
            <div className="mt-3 text-sm text-cr-muted">
              <p className="flex flex-wrap gap-x-2 gap-y-1">
                <span>Subscription <b className="text-cr-ink">{usd2(PRICE)}/mo</b></span>→
                <span>After {STORE_FEE * 100}% store fee <b className="text-cr-ink">{usd2(PRICE * (1 - STORE_FEE))}</b></span>→
                <span>Your share <b className="text-cr-ink">{CUT * 100}%</b></span>→
                <span>Per member <b className="text-cr-accent">{usd2(RATE)}/mo</b></span>
              </p>
              <p className="mt-2">We assume the people who subscribe join evenly over the next 12 months and that about {PLAN_CHURN * 100}% of members cancel each month. You're paid every month a member stays subscribed. Actual earnings depend on your audience and where members subscribe.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ShareKit({ link }: { link: string }) {
  const [qr, setQr] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    QRCode.toDataURL(`https://${link}`, { margin: 0, width: 240, color: { dark: "#14132b", light: "#ffffff" } }).then(setQr);
  }, [link]);
  const caps = [
    ["Instagram story", "Pair with the story card", `You keep asking how I never miss a session. Now you can train alongside me 💪 Check in with me on Pactara after every workout: ${link}`],
    ["TikTok caption", "For your next gym video", `The question I get most: "how are you this consistent?" Showing up is easier when someone's expecting you. So I'm bringing you with me. Join me on Pactara, check in after every workout, and let's keep each other honest. Link in bio 🏋️`],
    ["Bio link", "Instagram and TikTok", `Train with me on Pactara 💪 → ${link}`],
  ];
  const [texts, setTexts] = useState(caps.map((c) => c[2]));

  async function download() {
    if (!cardRef.current) return;
    const { toPng } = await import("html-to-image");
    const url = await toPng(cardRef.current, { pixelRatio: 3 });
    const a = document.createElement("a");
    a.href = url;
    a.download = "pactara-story.png";
    a.click();
  }

  return (
    <section id="kit" className={cn(card, "scroll-mt-4 p-5")}>
      <p className={cn(eyebrow, "text-cr-accent")}>Share kit</p>
      <h2 className={cn("mt-1 text-xl font-bold", display)}>Ready to post</h2>
      <p className="text-sm text-cr-muted">Edit any caption to sound like you, then copy it. Your link is already in each one.</p>
      <div className="mt-5 grid grid-cols-1 gap-5 min-[901px]:grid-cols-[auto_minmax(0,1fr)]">
        <div className="mx-auto w-[250px]">
          <div ref={cardRef} className="relative flex aspect-[9/16] flex-col overflow-hidden rounded-[22px] bg-cr-accent p-5 text-cr-accent-ink">
            <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full border-2 border-current opacity-[0.16]" />
            <div className="pointer-events-none absolute -left-28 top-1/2 size-56 rounded-full border-2 border-current opacity-[0.16]" />
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className="grid size-5 place-items-center rounded-md bg-cr-accent-ink text-[10px] text-cr-accent">P</span> Pactara
            </div>
            <p className={cn("mt-10 text-[34px] font-extrabold leading-[0.98]", display)}>Check in with me after every workout</p>
            <div className="mt-auto">
              <div className="grid size-[120px] place-items-center rounded-2xl bg-white p-3">{qr && <img src={qr} alt="QR code for your link" className="size-full" />}</div>
              <p className="mt-3 font-cr-mono text-[10px] leading-snug">Scan or tap the link<br />{link}</p>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-cr-muted">Screenshot this card and post it to your story.</p>
          <button onClick={download} className="mx-auto mt-2 flex items-center gap-1.5 rounded-lg bg-cr-accent-soft px-3 py-1.5 text-sm font-semibold text-cr-accent">
            <Download className="size-4" /> Download image
          </button>
        </div>
        <div className="min-w-0 space-y-3">
          {caps.map(([title, note], i) => (
            <div key={title} className="rounded-2xl border border-cr-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm"><b>{title}</b> <span className="ml-1 text-xs text-cr-muted">{note}</span></p>
                <button onClick={() => copy(texts[i], `${title} caption copied`)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cr-accent-soft px-3 py-1.5 text-sm font-semibold text-cr-accent">
                  <Copy className="size-3.5" /> Copy
                </button>
              </div>
              <textarea
                value={texts[i]}
                onChange={(e) => setTexts(texts.map((t, j) => (j === i ? e.target.value : t)))}
                rows={3}
                className="mt-3 w-full resize-y rounded-xl bg-cr-sunk p-3 text-sm outline-none"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Funnel({ t }: { t: { taps: number; store: number; signups: number; active: number; paying: number } }) {
  const steps = [
    { label: "Link taps", v: t.taps, icon: MousePointerClick },
    { label: "App Store visits", v: t.store, icon: Smartphone },
    { label: "Sign-ups", v: t.signups, icon: UserPlus },
    { label: "Checking in", v: t.active, icon: Flame },
    { label: "Paying members", v: t.paying, icon: Crown },
  ];
  return (
    <div className={cn(card, "mt-4 grid grid-cols-2 overflow-hidden min-[901px]:grid-cols-5")}>
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].v : 0;
        const last = i === 4;
        return (
          <div key={s.label} className={cn("relative border-cr-line p-4", last ? "col-span-2 bg-cr-accent-soft min-[901px]:col-span-1" : "", i % 2 === 0 && !last ? "border-r" : "", i < 4 ? "border-b min-[901px]:border-b-0" : "", "min-[901px]:border-r min-[901px]:last:border-r-0")}>
            {i > 0 && (
              <span className="absolute -left-[22px] top-3 z-10 hidden rounded-full border border-cr-line bg-cr-surface px-1.5 py-0.5 text-[10px] font-semibold text-cr-muted min-[901px]:block">
                {prev ? `${Math.round((s.v / prev) * 100)}%` : "–"}
              </span>
            )}
            <p className={cn("flex items-center gap-1.5 text-xs text-cr-muted", i > 0 && "min-[901px]:pl-4")}><s.icon className="size-3.5 text-cr-accent" />{s.label}</p>
            <p className={cn("mt-2 text-[30px] font-extrabold leading-none", display, last && "text-cr-accent")}>{s.v.toLocaleString()}</p>
            <div className="mt-3 h-1 rounded-full bg-cr-sunk">
              <div className="h-full rounded-full bg-cr-accent" style={{ width: `${t.taps ? Math.min(100, (s.v / t.taps) * 100) : 0}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TapsChart({ series }: { series: { date: string; taps: number; signups: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = nice(Math.max(...series.map((s) => s.taps)));
  const empty = series.every((s) => !s.taps && !s.signups);
  const mid = series[Math.floor(series.length / 2)];
  return (
    <div className={cn(card, "min-w-0 p-5")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={cn("font-bold", display)}>Taps & sign-ups</h3>
        <div className="flex gap-3 text-xs text-cr-muted">
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-cr-accent-mid" />Taps</span>
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-cr-accent" />Sign-ups</span>
        </div>
      </div>
      <div className="relative mt-6 h-44 pl-7">
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-cr-line" style={{ top: `${(1 - f) * 100}%` }}>
            <span className="absolute -top-2 left-0 text-[10px] text-cr-faint">{Math.round(max * f)}</span>
          </div>
        ))}
        <div className="relative flex h-full items-end gap-[3px]">
          {series.map((s, i) => (
            <div key={s.date} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className="relative w-full rounded-t-[3px] bg-cr-accent-mid" style={{ height: `${(s.taps / max) * 100}%` }}>
                {s.signups > 0 && <div className="absolute bottom-0 w-full rounded-t-[3px] bg-cr-accent" style={{ height: `${Math.min(100, (s.signups / Math.max(1, s.taps)) * 100)}%` }} />}
              </div>
              {hover === i && !empty && (
                <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-cr-ink px-2.5 py-1.5 text-xs text-cr-bg">
                  {shortDate(s.date + "T12:00")} · {s.taps} taps · {s.signups} sign-ups
                </div>
              )}
            </div>
          ))}
        </div>
        {empty && (
          <div className="absolute inset-0 grid place-items-center pl-7">
            <span className="rounded-full border border-cr-line bg-cr-surface px-3 py-1.5 text-center text-xs text-cr-muted">Taps and sign-ups from your link will show up here.</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between pl-7 text-[11px] text-cr-faint">
        <span>{series[0] && shortDate(series[0].date + "T12:00")}</span>
        <span>{mid && shortDate(mid.date + "T12:00")}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function Recent({ recent }: { recent: { name: string; joined: string | null; status: string }[] }) {
  return (
    <div className={cn(card, "min-w-0 p-5")}>
      <div className="flex items-center justify-between">
        <h3 className={cn("font-bold", display)}>Recent members</h3>
        {recent.length > 0 && <span className={cn(eyebrow, "text-cr-muted")}>Last 7 joined</span>}
      </div>
      {recent.length === 0 ? (
        <div className="py-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-cr-accent-soft text-cr-accent"><UserPlus className="size-5" /></span>
          <p className="mt-3 font-bold">No sign-ups yet</p>
          <p className="mx-auto mt-1 max-w-[240px] text-sm text-cr-muted">People who join through your link will appear here with their progress.</p>
          <button onClick={scrollKit} className="mt-4 rounded-lg bg-cr-accent-soft px-4 py-2 text-sm font-semibold text-cr-accent">Open the share kit</button>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-cr-line">
          {recent.map((r, i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cr-accent-soft text-xs font-bold text-cr-accent">{r.name[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-cr-muted">{r.joined ? `Joined ${shortDate(r.joined)}` : ""}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                r.status === "Paying" ? "bg-cr-good-bg text-cr-good" : r.status === "Checking in" ? "bg-cr-warn-bg text-cr-warn" : "bg-cr-sunk text-cr-muted")}>
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="creator grid min-h-screen place-items-center bg-cr-bg px-6 text-center text-cr-ink"><div className="max-w-sm">{children}</div></div>;
}
