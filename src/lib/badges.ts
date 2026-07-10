import badge1 from "@/assets/badge-1.png";
import badge3 from "@/assets/badge-3.png";
import badge7 from "@/assets/badge-7.png";
import badge14 from "@/assets/badge-14.png";
import badge30 from "@/assets/badge-30.png";
import badge45 from "@/assets/badge-45.png";
import badge60 from "@/assets/badge-60.png";
import badge75 from "@/assets/badge-75.png";
import badge90 from "@/assets/badge-90.png";

export const BADGE_MILESTONES = [1, 3, 7, 14, 30, 45, 60, 75, 90] as const;
export type BadgeMilestone = (typeof BADGE_MILESTONES)[number];

export const BADGE_META: Record<
  number,
  { image: string; title: string; blurb: string }
> = {
  1: { image: badge1, title: "First day", blurb: "The hardest one." },
  3: { image: badge3, title: "3-day spark", blurb: "A pattern begins." },
  7: { image: badge7, title: "One week", blurb: "A full week of showing up." },
  14: { image: badge14, title: "Two weeks", blurb: "Momentum is real." },
  30: { image: badge30, title: "One month", blurb: "A month of mornings." },
  45: { image: badge45, title: "45 days", blurb: "Discipline compounding." },
  60: { image: badge60, title: "60 days", blurb: "Two months strong." },
  75: { image: badge75, title: "75 days", blurb: "Fewer than 1% get here." },
  90: { image: badge90, title: "90 days", blurb: "Identity, not effort." },
};

export function newlyEarnedMilestones(
  prevBest: number,
  newBest: number,
): number[] {
  return BADGE_MILESTONES.filter((m) => m > prevBest && m <= newBest);
}
