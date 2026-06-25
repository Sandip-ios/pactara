import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowRight, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Pactara" },
      { name: "description", content: "Reset your Pactara account password." },
    ],
  }),
  component: ForgotPasswordPage,
});

const PURPLE = "#7C3AED";
const PURPLE_DEEP = "#5B21B6";
const INPUT_BG = "#EFEDEA";
const LABEL = "#8A8580";
const TEXT_MUTED = "#6B6660";
const TEXT = "#0A0A0A";

function ForgotPasswordPage() {
  const emailRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleInput = () => {
    setError(null);
    setCanSubmit((emailRef.current?.value.trim().length ?? 0) > 0);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const email = emailRef.current?.value.trim() ?? "";
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
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

      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-[14px] font-medium mb-6"
        style={{ color: TEXT_MUTED }}
      >
        <ArrowLeft size={16} /> Back to sign in
      </Link>

      <h1 className="text-[44px] font-bold tracking-tight leading-[1.05]">
        Forgot password?
      </h1>
      <p className="mt-4 text-[16px]" style={{ color: TEXT_MUTED }}>
        Enter your email and we'll send you a link to reset your password.
      </p>

      {sent ? (
        <div
          className="mt-7 rounded-2xl px-5 py-5 text-[15px]"
          style={{ background: INPUT_BG, color: TEXT }}
        >
          Check your inbox for a reset link. It may take a minute to arrive.
        </div>
      ) : (
        <>
          <div className="mt-7 rounded-2xl px-5 pt-4 pb-4" style={{ background: INPUT_BG }}>
            <label
              className="block text-[12px] font-semibold tracking-wider"
              style={{ color: LABEL }}
            >
              EMAIL
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              ref={emailRef}
              onInput={handleInput}
              placeholder="you@example.com"
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
              <>Send reset link <ArrowRight size={20} /></>
            )}
          </button>
        </>
      )}
    </div>
  );
}
