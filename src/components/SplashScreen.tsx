import { useEffect, useState } from "react";

const SHOW_MS = 1200;
const FADE_MS = 400;
const SESSION_KEY = "pactara-splash-shown";

export function SplashScreen() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }
    setMounted(true);
    setVisible(true);
    const hide = setTimeout(() => setVisible(false), SHOW_MS);
    const unmount = setTimeout(() => setMounted(false), SHOW_MS + FADE_MS);
    return () => {
      clearTimeout(hide);
      clearTimeout(unmount);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at center, #1a0b2e 0%, #0a0a0a 60%, #000000 100%)",
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        className="text-[44px] font-black tracking-tight"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <span style={{ color: "#7C3AED" }}>P</span>
        <span style={{ color: "#ffffff" }}>actara</span>
      </div>
    </div>
  );
}
