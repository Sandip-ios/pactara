import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Info, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  fmt,
  fmtChange,
  type FunnelStage,
  type Health,
  type Metric,
  type MetricDefinition,
  type CohortRow,
} from "@/lib/admin/analytics-data";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-black tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function Panel({
  title,
  description,
  right,
  children,
  className,
}: {
  title?: string;
  description?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-3xl border border-border/60 bg-card p-6 shadow-sm", className)}>
      {(title || right) && (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function InfoTip({ label, def }: { label: string; def?: MetricDefinition }) {
  if (!def) return null;
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`How ${label} is calculated`}
        className="rounded-full p-0.5 text-muted-foreground transition hover:text-pactara-purple"
      >
        <Info className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-80 rounded-2xl text-sm">
        <p className="font-bold text-foreground">{label}</p>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What it means</dt>
            <dd className="text-foreground">{def.what}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Formula</dt>
            <dd className="rounded-lg bg-pactara-purple-soft px-2 py-1 font-mono text-xs text-pactara-purple-deep">
              {def.formula}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why it matters</dt>
            <dd className="text-foreground">{def.why}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">How to read it</dt>
            <dd className="text-foreground">{def.interpret}</dd>
          </div>
        </dl>
      </PopoverContent>
    </Popover>
  );
}

const HEALTH_STYLES: Record<Health, string> = {
  healthy: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  watch: "bg-amber-50 text-amber-700 ring-amber-200",
  attention: "bg-rose-50 text-rose-700 ring-rose-200",
};
const HEALTH_LABEL: Record<Health, string> = {
  healthy: "Healthy",
  watch: "Watch",
  attention: "Needs attention",
};

export function HealthPill({ health }: { health: Health }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        HEALTH_STYLES[health],
      )}
    >
      {HEALTH_LABEL[health]}
    </span>
  );
}

export function Sparkline({ data, positive = true }: { data: number[]; positive?: boolean }) {
  const points = data.map((v, i) => ({ i, v }));
  const stroke = positive ? "var(--pactara-purple)" : "oklch(0.6 0.2 20)";
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={`spark-${stroke}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#spark-${stroke})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChangeChip({
  change,
  format,
  compare,
  suffix = "vs previous period",
}: {
  change: number;
  format: Metric["format"];
  compare: boolean;
  suffix?: string;
}) {
  if (!compare) return null;
  const up = change >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-semibold",
        up ? "text-emerald-600" : "text-rose-600",
      )}
    >
      {up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
      {fmtChange(change, format)}
      <span className="font-normal text-muted-foreground">{suffix}</span>
    </span>
  );
}

export function MetricCard({ metric, compare }: { metric: Metric; compare: boolean }) {
  return (
    <div className="flex flex-col rounded-3xl border border-border/60 bg-card p-5 shadow-sm transition hover:border-pactara-purple/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-muted-foreground">{metric.label}</span>
          <InfoTip label={metric.label} def={metric.definition} />
        </div>
        <HealthPill health={metric.health} />
      </div>
      <p className="mt-3 text-4xl font-black tracking-tight text-foreground">
        {fmt(metric.value, metric.format)}
      </p>
      <div className="mt-1">
        <ChangeChip change={metric.change} format={metric.format} compare={compare} suffix="" />
      </div>
      <Sparkline data={metric.spark} positive={metric.change >= 0} />
      <p className="mt-2 text-sm leading-snug text-muted-foreground">{metric.explanation}</p>
      {metric.href && (
        <Link
          to={metric.href}
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-pactara-purple hover:underline"
        >
          View details <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  def,
}: {
  label: string;
  value: string;
  sub?: string;
  def?: MetricDefinition;
}) {
  return (
    <div className="rounded-2xl bg-pactara-purple-soft/60 p-4">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <InfoTip label={label} def={def} />
      </div>
      <p className="mt-1 text-2xl font-black tracking-tight text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function FunnelView({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0].users;
  return (
    <div className="space-y-1">
      {stages.map((stage, i) => {
        const prev = i === 0 ? null : stages[i - 1];
        const dropCount = prev ? prev.users - stage.users : 0;
        const dropPct = prev ? dropCount / prev.users : 0;
        const severe = dropPct >= 0.2;
        return (
          <div key={stage.id}>
            {prev && (
              <div
                className={cn(
                  "ml-4 flex items-center gap-2 py-1 text-xs font-semibold",
                  severe ? "text-rose-600" : "text-muted-foreground",
                )}
              >
                <span className="text-base leading-none">↓</span>
                {Math.round(dropPct * 100)}% drop-off · {dropCount.toLocaleString()} users lost
              </div>
            )}
            <div className="relative overflow-hidden rounded-2xl bg-muted/60">
              <div
                className="absolute inset-y-0 left-0 rounded-2xl bg-linear-to-r from-pactara-purple to-pactara-purple-deep"
                style={{ width: `${Math.max(8, (stage.users / top) * 100)}%` }}
              />
              <div className="relative flex items-center justify-between px-4 py-3">
                <span className="text-sm font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
                  {stage.label}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {stage.users.toLocaleString()}{" "}
                  <span className="font-medium text-muted-foreground">
                    {Math.round((stage.users / top) * 1000) / 10}%
                  </span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function heat(v: number) {
  const alpha = Math.min(0.9, 0.08 + v * 1.4);
  return `color-mix(in oklab, var(--pactara-purple) ${Math.round(alpha * 100)}%, white)`;
}

export function CohortTable({ rows, columns }: { rows: CohortRow[]; columns: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
        <thead>
          <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-2 text-left">Signup week</th>
            <th className="px-2 text-left">Users</th>
            {columns.map((c) => (
              <th key={c} className="px-2 text-center">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cohort}>
              <td className="px-2 py-1 font-semibold text-foreground">{r.cohort}</td>
              <td className="px-2 py-1 text-muted-foreground">{r.size}</td>
              {r.values.map((v, i) => (
                <td key={i} className="p-0">
                  {v === null ? (
                    <div className="rounded-lg bg-muted/50 py-2 text-center text-muted-foreground">—</div>
                  ) : (
                    <div
                      className="rounded-lg py-2 text-center font-semibold"
                      style={{ background: heat(v), color: v > 0.35 ? "white" : "inherit" }}
                    >
                      {Math.round(v * 100)}%
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InsightCallout({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "good" | "bad" | "neutral";
  title: string;
  children: ReactNode;
}) {
  const styles = {
    good: "border-emerald-200 bg-emerald-50/70",
    bad: "border-rose-200 bg-rose-50/70",
    neutral: "border-pactara-purple/20 bg-pactara-purple-soft/70",
  }[tone];
  return (
    <div className={cn("rounded-2xl border p-5", styles)}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 text-base font-semibold leading-snug text-foreground">{children}</div>
    </div>
  );
}

export function BarList({
  items,
  format = "percent",
}: {
  items: { label: string; value: number; note?: string }[];
  format?: "percent" | "number";
}) {
  const max = Math.max(...items.map((i) => i.value), 0.0001);
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium text-foreground">{i.label}</span>
            <span className="font-bold text-foreground">
              {format === "percent" ? `${Math.round(i.value * 100)}%` : i.value.toLocaleString()}
              {i.note && <span className="ml-2 font-normal text-muted-foreground">{i.note}</span>}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-linear-to-r from-pactara-purple to-pactara-purple-deep"
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DemoBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-200">
      Demo data
    </span>
  );
}

export { fmt, fmtChange };
