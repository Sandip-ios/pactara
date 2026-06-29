import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { saveMyTimezone } from "@/lib/daily-posts.functions";

const STORAGE_KEY = "saved-timezone";

/** Detects the browser timezone once per session and saves it to the user's profile. */
export function TimezoneSync() {
  const save = useServerFn(saveMyTimezone);
  const queryClient = useQueryClient();
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === tz) return;
      save({ data: { timezone: tz } })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["my-groups"] });
          queryClient.invalidateQueries({ queryKey: ["group-feed"] });
          queryClient.invalidateQueries({ queryKey: ["pending-checkins"] });
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
  }, [queryClient, save]);
  return null;
}
