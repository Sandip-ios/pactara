import { createFileRoute } from "@tanstack/react-router";
import { MorningRitual } from "./_authenticated/check-in.index";

export const Route = createFileRoute("/dev-ritual")({
  component: () => <MorningRitual groupId={null} switcher={null} onPosted={() => {}} />,
});
