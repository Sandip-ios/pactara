import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Filter,
  Repeat,
  Users,
  HeartHandshake,
  Sprout,
  CreditCard,
  Database,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildAnalytics, RANGE_LABELS, type Analytics, type RangeKey } from "@/lib/admin/analytics-data";
import { DemoBadge } from "@/components/admin/kit";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pactara Founder Analytics" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Private founder analytics for Pactara." },
    ],
  }),
  component: AdminLayout,
});

type Ctx = { range: RangeKey; compare: boolean; data: Analytics };
const AdminContext = createContext<Ctx | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside the admin layout");
  return ctx;
}

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/funnel", label: "Funnel", icon: Filter },
  { to: "/admin/retention", label: "Retention", icon: Repeat },
  { to: "/admin/groups", label: "Groups", icon: Users },
  { to: "/admin/accountability", label: "Accountability", icon: HeartHandshake },
  { to: "/admin/growth", label: "Growth", icon: Sprout },
  { to: "/admin/revenue", label: "Revenue", icon: CreditCard },
  { to: "/admin/events", label: "Events / Data", icon: Database },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

const RANGES: RangeKey[] = ["today", "7d", "30d", "90d", "custom"];

function AdminLayout() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [compare, setCompare] = useState(true);
  const data = useMemo(() => buildAnalytics(range, compare), [range, compare]);

  return (
    <AdminContext.Provider value={{ range, compare, data }}>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex max-w-[1500px]">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <TopBar
              range={range}
              setRange={setRange}
              compare={compare}
              setCompare={setCompare}
            />
            <main className="px-5 pb-20 pt-6 lg:px-8">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </AdminContext.Provider>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-border/60 bg-pactara-purple-soft/40 px-4 py-6 lg:block">
      <div className="mb-8 flex items-center gap-2 px-2">
        <span className="grid size-8 place-items-center rounded-xl bg-pactara-purple text-sm font-black text-pactara-purple-foreground">
          P
        </span>
        <div>
          <p className="text-sm font-black leading-none tracking-tight">Pactara</p>
          <p className="text-xs text-muted-foreground">Founder analytics</p>
        </div>
      </div>
      <nav className="space-y-1">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: "exact" in item ? item.exact : false }}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-white hover:text-foreground data-[status=active]:bg-white data-[status=active]:text-pactara-purple data-[status=active]:shadow-sm"
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <p className="mt-10 flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-pactara-purple" />
        Internal only. No private check-in media is shown here.
      </p>
    </aside>
  );
}

function TopBar({
  range,
  setRange,
  compare,
  setCompare,
}: {
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  compare: boolean;
  setCompare: (c: boolean) => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 px-5 py-3 backdrop-blur lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <MobileNav />
        <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                range === r
                  ? "bg-pactara-purple text-pactara-purple-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="size-4 accent-[var(--pactara-purple)]"
          />
          Compare to previous period
        </label>
        <div className="ml-auto">
          <DemoBadge />
        </div>
      </div>
    </header>
  );
}

function MobileNav() {
  return (
    <div className="w-full overflow-x-auto lg:hidden">
      <nav className="flex gap-1">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: "exact" in item ? item.exact : false }}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground data-[status=active]:bg-pactara-purple-soft data-[status=active]:text-pactara-purple"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function AdminSection({ children }: { children: ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}
