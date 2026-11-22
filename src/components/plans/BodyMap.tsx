import { muscleMapLabel, type MuscleMap, type MuscleRegion } from "@/lib/workout-plans";

const LEVEL_FILL = ["#DCD6CF", "#C4B5FD", "#7C3AED"] as const;
const NEUTRAL = "#E2DDD7";
const SILHOUETTE = "#EFEBE6";

type Region = MuscleRegion | "head" | "hips" | "lowback";
type Shape =
  | { t: "rect"; x: number; y: number; w: number; h: number; rx: number; r: Region }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; r: Region }
  | { t: "circle"; cx: number; cy: number; rr: number; r: Region };

const rect = (x: number, y: number, w: number, h: number, rx: number, r: Region): Shape => ({ t: "rect", x, y, w, h, rx, r });
const ell = (cx: number, cy: number, rx: number, ry: number, r: Region): Shape => ({ t: "ellipse", cx, cy, rx, ry, r });
const circ = (cx: number, cy: number, rr: number, r: Region): Shape => ({ t: "circle", cx, cy, rr, r });

const SHAPES: Shape[] = [
  // Front
  circ(30, 10, 7, "head"),
  ell(17, 27, 6, 5, "shoulders"),
  ell(43, 27, 6, 5, "shoulders"),
  rect(19.5, 24, 10, 11, 3.5, "chest"),
  rect(30.5, 24, 10, 11, 3.5, "chest"),
  ell(12, 42, 4, 9, "biceps"),
  ell(48, 42, 4, 9, "biceps"),
  ell(9.5, 60, 3.4, 9, "forearms"),
  ell(50.5, 60, 3.4, 9, "forearms"),
  rect(23, 37, 14, 22, 4, "abs"),
  rect(21, 60, 18, 7, 3, "hips"),
  ell(24.5, 83, 6, 15, "quads"),
  ell(35.5, 83, 6, 15, "quads"),
  ell(24.5, 111, 4.5, 11, "calves"),
  ell(35.5, 111, 4.5, 11, "calves"),
  // Back
  circ(100, 10, 7, "head"),
  ell(100, 22, 9, 4.5, "traps"),
  ell(87, 28, 6, 5, "shoulders"),
  ell(113, 28, 6, 5, "shoulders"),
  rect(89.5, 28, 10, 24, 4, "back"),
  rect(100.5, 28, 10, 24, 4, "back"),
  ell(82, 42, 4, 9, "triceps"),
  ell(118, 42, 4, 9, "triceps"),
  ell(79.5, 60, 3.4, 9, "forearms"),
  ell(120.5, 60, 3.4, 9, "forearms"),
  rect(93, 53, 14, 7, 3, "lowback"),
  ell(94.5, 67, 6.5, 6.5, "glutes"),
  ell(105.5, 67, 6.5, 6.5, "glutes"),
  ell(94.5, 88, 5.5, 13, "hamstrings"),
  ell(105.5, 88, 5.5, 13, "hamstrings"),
  ell(94.5, 112, 4.5, 10, "calves"),
  ell(105.5, 112, 4.5, 10, "calves"),
];

function Silhouette() {
  return (
    <>
      <rect x="26" y="15" width="8" height="6" rx="2" />
      <rect x="16" y="21" width="28" height="47" rx="9" />
      <rect x="7" y="23" width="9" height="46" rx="4.5" />
      <rect x="44" y="23" width="9" height="46" rx="4.5" />
      <rect x="17.5" y="62" width="12" height="60" rx="6" />
      <rect x="30.5" y="62" width="12" height="60" rx="6" />
    </>
  );
}

/** Front and back figure with each muscle filled by how hard the plan or day works it. */
export function BodyMap({ muscles, width, height }: { muscles: MuscleMap; width: number; height: number }) {
  const fill = (r: Region) =>
    r === "head" || r === "hips" || r === "lowback" ? NEUTRAL : LEVEL_FILL[muscles[r] ?? 0];
  return (
    <svg viewBox="0 0 130 124" width={width} height={height} role="img" aria-label={muscleMapLabel(muscles)}>
      <g fill={SILHOUETTE}>
        <Silhouette />
      </g>
      <g fill={SILHOUETTE} transform="translate(70 0)">
        <Silhouette />
      </g>
      {SHAPES.map((s, i) =>
        s.t === "rect" ? (
          <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={fill(s.r)} data-region={s.r} />
        ) : s.t === "ellipse" ? (
          <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill(s.r)} data-region={s.r} />
        ) : (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.rr} fill={fill(s.r)} data-region={s.r} />
        ),
      )}
    </svg>
  );
}
