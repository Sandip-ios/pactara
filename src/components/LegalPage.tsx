import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-[100dvh] w-full bg-background text-foreground"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-6">
          <Link to="/" className="text-lg font-bold tracking-tight">
            Pactara
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Home
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-6 py-14">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        {updated ? (
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
        ) : null}
        <div className="prose prose-neutral mt-10 max-w-none text-[15px] leading-relaxed text-foreground [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1 [&_a]:text-primary [&_a]:underline">
          {children}
        </div>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-3 px-6 py-8 text-[13px] text-muted-foreground md:flex-row">
          <div>© {new Date().getFullYear()} Pactara</div>
          <div className="flex gap-5">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/support" className="hover:text-foreground">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
