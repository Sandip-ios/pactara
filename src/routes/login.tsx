import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Pactara" },
      { name: "description", content: "Sign in to your Pactara account." },
    ],
  }),
  component: LoginPage,
});

const PURPLE = "#7C3AED";
const PURPLE_DEEP = "#5B21B6";
const INPUT_BG = "#EFEDEA";
const LABEL = "#8A8580";
const PLACEHOLDER = "#B7B2AC";
const TEXT_MUTED = "#6B6660";
const TEXT = "#0A0A0A";

function LoginPage() {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberedEmail, setRememberedEmail] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("last-email");
      if (stored) {
        setRememberedEmail(stored);
        if (emailRef.current && !emailRef.current.value) {
          emailRef.current.value = stored;
        }
        return;
      }
      supabase.auth.getSession().then(({ data }) => {
        const email = data.session?.user?.email;
        if (email) {
          localStorage.setItem("last-email", email);
          setRememberedEmail(email);
          if (emailRef.current && !emailRef.current.value) {
            emailRef.current.value = email;
          }
        }
      });
    } catch {}
  }, []);


  const handleSignIn = async () => {
    if (submitting) return;
    const email = emailRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";
    if (!email || !password) return;
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("last-email", email);
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("invite-dismissed");
      sessionStorage.removeItem("show-welcome");
    }
    navigate({ to: "/home" });
  };

  return (
    <div
      className="min-h-[100dvh] w-full flex flex-col px-6 pt-14 pb-8"
      style={{ background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: TEXT }}
    >
      {/* Wordmark */}
      <div className="text-[28px] font-bold tracking-tight leading-none">
        <span style={{ color: PURPLE }}>P</span>
        <span>actara</span>
      </div>

      {/* Spacer pushes content down */}
      <div className="flex-1" />


      {/* Welcome */}
      <h1 className="text-[44px] font-bold tracking-tight leading-[1.05]">
        Welcome back.
      </h1>
      <p className="mt-4 text-[16px]" style={{ color: TEXT_MUTED }}>
        Sign in with your email and password.
      </p>

      {/* Email */}
      <div
        className="mt-7 rounded-2xl px-5 pt-4 pb-4"
        style={{ background: INPUT_BG }}
      >
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
          defaultValue={rememberedEmail}
          
          placeholder="you@example.com"
          className="mt-1.5 w-full bg-transparent outline-none text-[17px]"
          style={{ color: TEXT }}
        />
      </div>

      {/* Password */}
      <div
        className="mt-4 rounded-2xl px-5 pt-4 pb-4"
        style={{ background: INPUT_BG }}
      >
        <label
          className="block text-[12px] font-semibold tracking-wider"
          style={{ color: LABEL }}
        >
          PASSWORD
        </label>
        <div className="mt-1.5 flex items-center gap-3">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            ref={passwordRef}
            defaultValue=""
            
            placeholder="Your password"
            className="flex-1 bg-transparent outline-none text-[17px]"
            style={{ color: TEXT }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="shrink-0"
            style={{ color: "#6B6660" }}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      <Link
        to="/forgot-password"
        className="mt-3 self-start text-[14px] font-medium"
        style={{ color: PURPLE }}
      >
        Forgot password?
      </Link>


      {error && (
        <div className="mt-3 text-[13px] text-red-600" role="alert">{error}</div>
      )}

      {/* Sign in button */}
      <button
        type="button"
        onClick={handleSignIn}
        disabled={submitting}
        className="mt-5 w-full rounded-2xl py-5 flex items-center justify-center gap-2 text-[17px] font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
        style={{
          background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DEEP} 100%)`,
          boxShadow: "0 10px 30px -10px rgba(124, 58, 237, 0.55)",
        }}
      >
        {submitting ? <Loader2 size={20} className="animate-spin" /> : <>Sign in <ArrowRight size={20} /></>}
      </button>

      {/* Footer */}
      <p className="mt-5 text-center text-[14px]" style={{ color: TEXT_MUTED }}>
        New to Pactara?{" "}
        <Link to="/signup" className="font-semibold" style={{ color: PURPLE }}>
          Create a free account
        </Link>
      </p>
    </div>
  );
}
