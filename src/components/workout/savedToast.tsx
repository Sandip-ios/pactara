import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

/** "“Push day” is in My workouts": dark, at the top, so it never covers the buttons. */
export function showSavedToast(name: string) {
  toast(`“${name}” is in My workouts`, {
    position: "top-center",
    icon: <CheckCircle2 size={18} style={{ color: "#4ADE80" }} aria-hidden />,
    style: { background: "#141218", color: "#FFFFFF", border: "none", borderRadius: 16, fontSize: 14, fontWeight: 600 },
  });
}

/** Errors for save/share actions, in the same place. */
export function showTopError(message: string) {
  toast(message, {
    position: "top-center",
    style: { background: "#141218", color: "#FFFFFF", border: "none", borderRadius: 16, fontSize: 14, fontWeight: 600 },
  });
}
