import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { WelcomeSheet } from "@/components/WelcomeSheet";

export const Route = createFileRoute("/dev-welcome")({
  component: DevWelcome,
});

function DevWelcome() {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <button onClick={() => setOpen(true)} className="px-4 py-2 rounded-lg bg-purple-600 text-white">
        Open Welcome
      </button>
      {open && <WelcomeSheet firstName="Jordan" onClose={() => setOpen(false)} />}
    </div>
  );
}
