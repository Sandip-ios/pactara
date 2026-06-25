import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set new password — Pactara" },
      { name: "description", content: "Set a new password for your Pactara account." },
    ],
  }),
  component: ResetPasswordPage,
});

const PURPLE = "#7C3AED";
const PURPLE_DEEP = "#5B21B6";
const INPUT_BG = "#EFEDEA";
const LABEL = "#8A8580";
const TEXT_MUTED = "#6B6660";
const TEXT = "#0A0A0A";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase auto-detects the recovery token from the URL hash and emits PASSWORD_RECOVERY.
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });
    // Fallback: if there's already a session (link already consumed), allow update too.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setReady(true);
    });
    // If after a short window neither happened, the link is likely invalid/expired.
    const t = setTimeout(() => {
      if (cancelled) return;
      setReady((r) => {
        if (!r) setLinkError("This reset link is invalid or has expired. Request a new one.");
        return r;
      });
    }, 2500);
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const handleInput = () => {
    setError(null);
    const p = passwordRef.current?.value ?? "";
    const c = confirmRef.current?.value ?? "";
    setCanSubmit(p.length >= 8 && c.length >= 8);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const password = passwordRef.current?.value ?? "";
    const confirm = confirmRef.current?.value ?? "";
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Sign out so the user logs in fresh with the new password.
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col px-6 pt-14 pb-8"
      style={{ background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: TEXT }}
    >
      <div className="text-[28px] font-bold tracking-tight leading-none">
        <span style={{ color: PURPLE }}>P</span>
        <span>actara</span>
      </div>

      <div className="flex-1" />

      <h1 className="text-[44px] font-bold tracking-tight leading-[1.05]">
        Set a new password.
      </h1>
      <p className="mt-4 text-[16px]" style={{ color: TEXT_MUTED }}>
        Choose a new password to finish signing back in.
      </p>

      {linkError ? (
        <div className="mt-7 space-y-4">
          <div
            className="rounded-2xl px-5 py-5 text-[15px]"
            style={{ background: INPUT_BG, color: TEXT }}
          >
            {linkError}
          </div>
          <Link
            to="/forgot-password"
            className="block text-center text-[15px] font-semibold"
            style={{ color: PURPLE }}
          >
            Request a new link
          </Link>
        </div>
      ) : !ready ? (
        <div className="mt-7 flex items-center gap-2 text-[15px]" style={{ color: TEXT_MUTED }}>
          <Loader2 size={18} className="animate-spin" /> Verifying link…
        </div>
      ) : (
        <>
          <div className="mt-7 rounded-2xl px-5 pt-4 pb-4" style={{ background: INPUT_BG }}>
            <label
              className="block text-[12px] font-semibold tracking-wider"
              style={{ color: LABEL }}
            >
              NEW PASSWORD
            </label>
            <div className="mt-1.5 flex items-center gap-3">
              <input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                ref={passwordRef}
                onInput={handleInput}
                placeholder="At least 8 characters"
                className="flex-1 bg-transparent outline-none text-[17px]"
                style={{ color: TEXT }}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="shrink-0"
                style={{ color: "#6B6660" }}
              >
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl px-5 pt-4 pb-4" style={{ background: INPUT_BG }}>
            <label
              className="block text-[12px] font-semibold tracking-wider"
              style={{ color: LABEL }}
            >
              CONFIRM PASSWORD
            </label>
            <input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              ref={confirmRef}
              onInput={handleInput}
              placeholder="Re-enter your new password"
              className="mt-1.5 w-full bg-transparent outline-none text-[17px]"
              style={{ color: TEXT }}
            />
          </div>

          {error && (
            <div className="mt-3 text-[13px] text-red-600" role="alert">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="mt-5 w-full rounded-2xl py-5 flex items-center justify-center gap-2 text-[17px] font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
            style={{
              background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
              boxShadow: "0 10px 30px -10px rgba(124, 58, 237, 0.55)",
            }}
          >
            {submitting ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>Update password <ArrowRight size={20} /></>
            )}
          </button>
        </>
      )}
    </div>
  );
}
