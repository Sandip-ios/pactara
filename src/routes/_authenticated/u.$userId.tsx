import { createFileRoute, useParams } from "@tanstack/react-router";
import { ProfileView } from "@/components/profile/ProfileView";

export const Route = createFileRoute("/_authenticated/u/$userId")({
  component: MemberProfilePage,
});

function MemberProfilePage() {
  const { userId } = useParams({ from: "/_authenticated/u/$userId" });
  return <ProfileView userId={userId} />;
}
