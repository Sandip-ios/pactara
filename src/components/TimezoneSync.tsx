import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { saveMyTimezone } from "@/lib/daily-posts.functions";

const STORAGE_KEY = "saved-timezone";

/** Detects the browser timezone once per session and saves it to the user's profile. */
export function TimezoneSync() {
  const save = useServerFn(saveMyTimezone);
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === tz) return;
      save({ data: { timezone: tz } })
        .then(() => {
          try {
            sessionStorage.setItem(STORAGE_KEY, tz);
          } catch {
            /* ignore */
          }
        })
        .catch(() => {
          /* silent — non-critical */
        });
    } catch {
      /* ignore */
    }
  }, [save]);
  return null;
}
