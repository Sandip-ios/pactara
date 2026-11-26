import { muscleMapLabel, type MuscleMap, type MuscleRegion } from "@/lib/workout-plans";

/** Main focus (2), also worked (1), not worked (0). */
const LEVEL_FILL = ["#DCD5CC", "#F5B544", "#7C3AED"] as const;
const SKIN = "#EFEAE4";
const LINE = "#CFC7BC";

/** Right half of the body outline (x >= 50); the left half is a mirror. Only the outer edge is stroked. */
const EDGE =
  "M50 2 C57 2 60.5 8 60 14.5 C59.6 20 57.6 24.5 55 26.5 L55.5 30 C58.5 32 64 33 69 34 C75 35 78.5 39.5 79 45.5 C80 52 80.4 59 80.8 66 C82.2 74 83.6 83 83.2 91 C83.8 96 82.4 101 79.6 101 C78 98.5 78.6 94.5 78 91 C76.2 82 74.8 74 74.2 68 C73.3 61 72.2 55 70 50.5 C68.2 58 66.3 66 65.4 74 C66.2 82 68 88 67.6 96 C67.2 110 65.2 122 62.6 134 C64.2 144 64.6 154 61.2 166 C59.6 174 59.6 180 60.2 183 C62.4 186 62.2 189.5 58.8 189.5 C55.8 189.5 54.2 188 54.6 184 C54 174 55.2 160 54.2 150 C53.6 142 54.2 136 54.2 130 C54.2 118 53.2 106 50 100.5";
const HALF_FILL = EDGE + " L50 2Z";
const MIRROR = "translate(100 0) scale(-1 1)";

function Mirror({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <g transform={MIRROR}>{children}</g>
    </>
  );
}

function Outline({ skin = SKIN }: { skin?: string }) {
  return (
    <>
      <Mirror>
        <path d={HALF_FILL} fill={skin} />
      </Mirror>
      <Mirror>
        <path d={EDGE} fill="none" stroke={LINE} strokeWidth={0.9} strokeLinejoin="round" strokeLinecap="round" />
      </Mirror>
    </>
  );
}

function Front({ f }: { f: (r: MuscleRegion) => string }) {
  return (
    <Mirror>
      <path d="M55.5 30.5 C58.5 32 63 33 66 33.6 L57 36.5 Z" fill={f("traps")}/>
      <path d="M69 35 C75 36 78 40 78.3 46 C77 50 74 51 71.5 49.5 C70.5 44 69.5 39.5 66.8 36.5 Z" fill={f("shoulders")}/>
      <path d="M51 37 C56 35.5 62 35.5 66.5 37.5 C69 41 69.5 46 67.5 50 C62 53.5 55 53.5 51 51 Z" fill={f("chest")}/>
      <path d="M72.6 52 C75.8 54 77.5 59 77.8 65 C76.6 67.6 74.4 67.6 73.4 65 C72.4 61 72 56 72.6 52 Z" fill={f("biceps")}/>
      <path d="M76.4 70 C79.4 74 81.4 81 81.6 88 C80.6 90 79.2 90 78.6 88 C77.4 82 76.2 76 76.4 70 Z" fill={f("forearms")}/>
      <rect x="50.8" y="54.5" width="5.6" height="6.4" rx="1.8" fill={f("abs")}/>
      <rect x="50.8" y="62" width="5.6" height="6.4" rx="1.8" fill={f("abs")}/>
      <rect x="50.8" y="69.5" width="5.6" height="6.4" rx="1.8" fill={f("abs")}/>
      <path d="M58.4 54.5 C61.5 55 64 57 64.6 60 L64.3 74 C62.5 77 60 78 58.4 77 Z" fill={f("abs")}/>
      <path d="M52 99 C55 92 61 90 65.6 95 C66.6 108 65 121 61.4 131 C58 133.5 54.6 131.5 54 127 C53.4 117 53 108 52 99 Z" fill={f("quads")}/>
      <path d="M55.2 139 C59.5 140 62.8 146 62.6 154 C61.8 161 59.6 166 57.4 166.5 C56 160 55.2 150 55.2 139 Z" fill={f("calves")}/>
    </Mirror>
  );
}

function Back({ f }: { f: (r: MuscleRegion) => string }) {
  return (
    <Mirror>
      <path d="M50 28 C53 30.5 56 32 60 33 C64 33.6 66.5 34.4 67.4 36.6 C63 40 58 44 55 50 L50 57 Z" fill={f("traps")}/>
      <path d="M69 35 C75 36 78 40 78.3 46 C77 50 74 51 71.5 49.5 C70.5 44 69.5 39.5 66.8 36.5 Z" fill={f("shoulders")}/>
      <path d="M56 50 C60 45 65 42 68.6 44.5 C69.4 52 67.8 62 64.8 70 C61 75 56 78 52.4 79 L53 63 Z" fill={f("back")}/>
      <path d="M50 59 L52.6 63 L52.4 80 L50 82 Z" fill={f("back")}/>
      <path d="M72.6 52 C75.8 54 77.5 59 77.8 65 C76.6 67.6 74.4 67.6 73.4 65 C72.4 61 72 56 72.6 52 Z" fill={f("triceps")}/>
      <path d="M76.4 70 C79.4 74 81.4 81 81.6 88 C80.6 90 79.2 90 78.6 88 C77.4 82 76.2 76 76.4 70 Z" fill={f("forearms")}/>
      <path d="M50.8 85 C56 82 64 82.5 66.8 89 C67.6 95 66 100.5 61 102 C56 103 52 101.5 50.8 99 Z" fill={f("glutes")}/>
      <path d="M52.4 105 C56 103.5 62 103.5 65 106 C64.6 116 63.2 125 60.8 131.5 C57.6 133 54.8 131.4 54.2 127 C53.6 119 53 112 52.4 105 Z" fill={f("hamstrings")}/>
      <path d="M55.2 138 C60 139 63.2 145 63 153 C62 160 59.6 165 57.4 165.5 C56 159 55.2 149 55.2 138 Z" fill={f("calves")}/>
    </Mirror>
  );
}

/**
 * Front and back figures side by side. Each muscle is filled by how hard the plan or day works it:
 * purple = main focus, amber = also worked, grey = not worked.
 * `labels` adds FRONT / BACK under the figures (for the large map on the day page).
 */
/** "new" = the redesign colors: beige #E7E2DA base, amber #F59E0B, purple #7C3AED. */
const NEW_FILL = ["#D9D2C7", "#F59E0B", "#7C3AED"] as const;

export function BodyMap({ muscles, width, height, labels = false, tone = "classic" }: { muscles: MuscleMap; width: number; height: number; labels?: boolean; tone?: "classic" | "new" }) {
  const fills = tone === "new" ? NEW_FILL : LEVEL_FILL;
  const skin = tone === "new" ? "#E7E2DA" : SKIN;
  const f = (r: MuscleRegion) => fills[muscles[r] ?? 0];
  const h = labels ? 204 : 192;
  return (
    <svg viewBox={`0 0 148 ${h}`} width={width} height={height} role="img" aria-label={muscleMapLabel(muscles)}>
      <g transform="translate(-16 0)">
        <Outline skin={skin} />
        <Front f={f} />
      </g>
      <g transform="translate(64 0)">
        <Outline skin={skin} />
        <Back f={f} />
      </g>
      {labels && (
        <>
          <text x="34" y="202" textAnchor="middle" fontSize="8" fontWeight="700" fill="#A8A29E" letterSpacing="0.6">FRONT</text>
          <text x="114" y="202" textAnchor="middle" fontSize="8" fontWeight="700" fill="#A8A29E" letterSpacing="0.6">BACK</text>
        </>
      )}
    </svg>
  );
}
