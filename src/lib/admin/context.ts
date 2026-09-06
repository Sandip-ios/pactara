import { createContext, useContext } from "react";
import type { Analytics, RangeKey } from "./analytics-data";

export type AdminCtx = { range: RangeKey; compare: boolean; data: Analytics };

export const AdminContext = createContext<AdminCtx | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside the admin layout");
  return ctx;
}
