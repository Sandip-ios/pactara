import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "@/components/profile/ProfileView";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return <ProfileView />;
}
