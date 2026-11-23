import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FONT, W } from "@/components/workout/WorkoutBits";
import { getPublicPlan } from "@/lib/plan-share.functions";
import { planCoverAt, planOgDescription, planOgImage, planShareTitle } from "@/lib/plan-share";
import { SHARE_ORIGIN } from "@/lib/workout-share";
import { setPendingSharedPlan } from "@/lib/pending-shared-plan";

export const Route = createFileRoute("/p/$slug")({
  validateSearch: (s: Record<string, unknown>): { from?: string } => (typeof s["from"] === "string" ? { from: s["from"] } : {}),
  loaderDeps: ({ search }) => ({ from: search.from ?? null }),
  loader: ({ params, deps }) => getPublicPlan({ data: { slug: params.slug, from: deps.from } }),
  head: ({ params, loaderData }) => {
    const url = `${SHARE_ORIGIN}/p/${params.slug}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "Plan not available · Pactara" },
          { name: "description", content: "This workout plan isn't available on Pactara." },
          { property: "og:title", content: "Plan not available · Pactara" },
          { property: "og:description", content: "This workout plan isn't available on Pactara." },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = planShareTitle(loaderData.name);
    const description = planOgDescription(loaderData);
    const image = planOgImage(loaderData.coverUrl);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              { property: "og:image:width", content: "1200" },
              { property: "og:image:height", content: "630" },
              { property: "og:image:alt", content: `${loaderData.name}, a Pactara workout plan` },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: SharedPlanPage,
});

type Auth = "unknown" | "in" | "out";

function SharedPlanPage() {
  const { slug } = Route.useParams();
  const plan = Route.useLoaderData();
  const navigate = useNavigate();
  const [auth, setAuth] = useState<Auth>("unknown");

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const signedIn = !!data.session;
      setAuth(signedIn ? "in" : "out");
      // Signed in: the normal plan page (start button and all).
      if (signedIn && plan) void navigate({ to: "/plans/$slug", params: { slug: plan.slug }, replace: true });
    });
    return () => {
      alive = false;
    };
  }, [navigate, plan]);

  const keepAnd = (to: "/signup" | "/login") => {
    setPendingSharedPlan(slug);
    void navigate({ to });
  };

  if (!plan) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center gap-5 px-6 pt-28 text-center" style={{ background: W.bg, color: W.ink, fontFamily: FONT }}>
        <span className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: W.lilacSoft, color: W.violet }} aria-hidden>
          <ListChecks size={28} />
        </span>
        <h1 className="text-[22px] font-extrabold leading-tight">This plan isn't available</h1>
        <p className="text-[15px]" style={{ color: W.stone }}>
          It may have been taken down. Pactara has other free plans to try.
        </p>
        {auth === "in" ? (
          <Link to="/home" className="flex h-[52px] w-full max-w-[340px] items-center justify-center rounded-[26px] text-[16px] font-bold text-white" style={{ background: W.purple }}>
            Go to Home
          </Link>
        ) : auth === "out" ? (
          <button type="button" onClick={() => void navigate({ to: "/signup" })} className="h-[52px] w-full max-w-[340px] rounded-[26px] text-[16px] font-bold text-white" style={{ background: W.purple }}>
            Join free
          </button>
        ) : null}
      </div>
    );
  }

  const cover = planCoverAt(plan.coverUrl, 900, 1200);

  return (
    <div className="min-h-[100dvh] w-full" style={{ background: W.bg, color: W.ink, fontFamily: FONT }}>
      <div className="relative flex min-h-[520px] flex-col justify-between overflow-hidden" style={{ background: "#2E1065" }}>
        {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" />}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,18,24,.55) 0%, rgba(20,18,24,0) 26%, rgba(30,12,64,.55) 55%, rgba(46,16,101,.97) 100%)",
          }}
          aria-hidden
        />
        <header className="relative z-10 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+10px)]">
          <span className="text-[22px] font-black tracking-[-0.5px]" style={{ textShadow: "0 1px 6px rgba(0,0,0,.35)" }} aria-label="Pactara">
            <span style={{ color: "#A78BFA" }}>P</span>
            <span className="text-white">actara</span>
          </span>
          {auth === "out" && (
            <button type="button" onClick={() => keepAnd("/login")} className="flex h-11 items-center px-2 text-[15px] font-bold text-white">
              Sign in
            </button>
          )}
        </header>
        <div className="relative z-10 flex flex-col gap-2.5 px-5 pb-6 pt-24 text-white">
          {plan.sharerFirstName && (
            <span className="text-[15px] font-semibold" style={{ color: "#EDE9FE" }}>
              {plan.sharerFirstName} shared a plan with you
            </span>
          )}
          <span className="self-start rounded-full px-2.5 py-[5px] text-[12px] font-bold tracking-[0.4px]" style={{ background: "rgba(255,255,255,.18)" }}>
            PACTARA PLAN · {plan.level.toUpperCase()}
          </span>
          <h1 className="text-[40px] font-black leading-[1.02] tracking-[-1px]">{plan.name}</h1>
          <p className="text-[15px] leading-[1.45]" style={{ color: "#EDE9FE" }}>
            {plan.summary}
          </p>
        </div>
      </div>

      <div className="px-5 pb-5" style={{ background: "#2E1065" }}>
        <div className="grid grid-cols-3 gap-2">
          <Stat icon="🗓️" value={plan.weeks} label={plan.weeks === 1 ? "week" : "weeks"} />
          <Stat icon="💪" value={plan.daysPerWeek} label="days a week" />
          <Stat icon="⏱️" value={plan.minutes} label="min each" />
        </div>
      </div>

      <div className="flex flex-col gap-[10px] px-4 pb-[170px] pt-[22px]">
        {plan.weekOne.length > 0 && (
          <>
            <h2 className="mx-1 text-[18px] font-extrabold">Week 1 preview</h2>
            <ul className="overflow-hidden rounded-[20px] bg-white" style={{ boxShadow: "0 1px 2px rgba(20,18,24,.06)" }}>
              {plan.weekOne.map((title, i) => (
                <li key={`${i}-${title}`} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5" style={{ borderTop: i ? `1px solid ${W.divider}` : undefined }}>
                  <span className="text-[12px] font-extrabold tracking-[0.5px]" style={{ color: W.violet }}>
                    DAY {i + 1}
                  </span>
                  <span className="text-[16px] font-extrabold leading-tight">{title}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {auth === "out" && (
        <div
          className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 px-4 pt-[14px]"
          style={{ background: "linear-gradient(180deg, rgba(245,242,238,0) 0%, #F5F2EE 30%)", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={() => keepAnd("/signup")}
            className="h-14 w-full rounded-[28px] text-[16px] font-bold text-white"
            style={{ background: W.violet, boxShadow: "0 8px 20px rgba(109,40,217,.3)" }}
          >
            Join free to start this plan
          </button>
          <span className="text-center text-[12px]" style={{ color: W.muted }}>
            After you sign up, the plan is waiting for you.
          </span>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] p-[10px] text-white" style={{ background: "rgba(255,255,255,.1)" }}>
      <span className="text-[16px] leading-none" aria-hidden>
        {icon}
      </span>
      <span className="text-[18px] font-extrabold leading-none">{value}</span>
      <span className="text-[11px] leading-tight" style={{ color: "#DDD6FE" }}>
        {label}
      </span>
    </div>
  );
}
