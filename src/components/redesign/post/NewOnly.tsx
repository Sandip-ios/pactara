import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAppPrefs, useAppVersion } from "@/hooks/use-app-version";

/** New-version-only pages: wait for the version to resolve, then show or go Home. */
export function NewOnly({ children }: { children: ReactNode }) {
  const version = useAppVersion();
  const prefs = useAppPrefs();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !prefs.isSuccess) return null;
  return version === "new" ? <>{children}</> : <Navigate to="/home" replace />;
}
