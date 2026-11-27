import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NewHome } from "@/components/redesign/NewHome";

const { groups } = vi.hoisted(() => ({
  groups: ["Fourth", "Second", "Fifth", "First", "Third"].map((name, index) => ({
    id: `crew-${index}`,
    name,
    dayNumber: 1,
    members: [],
  })),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useRouteContext: () => ({ user: { id: "viewer" } }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { groups }, isLoading: false }),
}));
vi.mock("@/components/redesign/post/PostingStrip", () => ({ PostingStrip: () => null }));
vi.mock("@/lib/group-today.functions", () => ({ getGroupsToday: vi.fn() }));
vi.mock("@/components/redesign/social-query", () => ({ newActivityUnreadOptions: { queryKey: ['new-activity-unread'] } }));
vi.mock("@/components/plans/PlanBits", () => ({ useMyPlans: () => ({ isSuccess: false }) }));
vi.mock("@/lib/redesign-checkin", () => ({ beginNewCheckIn: vi.fn() }));
vi.mock("@/lib/use-open-at-top", () => ({ useOpenAtTop: () => ({ current: null }) }));
vi.mock("@/lib/status-bar-scroll", () => ({ useStatusBarScrollToTop: vi.fn() }));
vi.mock("@/components/workout/useClaimSharedWorkout", () => ({ useClaimSharedWorkout: vi.fn() }));
vi.mock("@/components/plans/useOpenSharedPlan", () => ({ useOpenSharedPlan: vi.fn() }));
vi.mock("@/components/redesign/NewNotifBanner", () => ({ NewNotifBanner: () => null }));

describe("new Home crews", () => {
  it("shows all five active crews in the supplied order, not just three", () => {
    const html = renderToStaticMarkup(<NewHome />);
    const names = Array.from(html.matchAll(/(Fourth|Second|Fifth|First|Third) · day/g), (match) => match[1]);
    expect(names).toEqual(["Fourth", "Second", "Fifth", "First", "Third"]);
  });
});