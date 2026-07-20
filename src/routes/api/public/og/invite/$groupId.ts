import { createFileRoute } from "@tanstack/react-router";

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "P";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export const Route = createFileRoute("/api/public/og/invite/$groupId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const groupId = String(params.groupId ?? "").trim();
        let inviterName = "Someone";
        let groupName = "their Pactara group";

        if (groupId) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: group } = await supabaseAdmin
              .from("groups")
              .select("name, owner_id")
              .eq("id", groupId)
              .maybeSingle();
            if (group) {
              groupName = (group.name as string) || groupName;
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("name")
                .eq("id", group.owner_id as string)
                .maybeSingle();
              if (profile?.name) inviterName = profile.name as string;
            }
          } catch {
            // fall through to defaults
          }
        }

        const initials = initialsFromName(inviterName);


        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#121214"/>
      <stop offset="100%" stop-color="#1C1C1F"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#7C3AED" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#7C3AED" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Initials circle -->
  <g transform="translate(600 250)">
    <circle r="140" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
    <text x="0" y="0" text-anchor="middle" dominant-baseline="central"
          font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-size="112" font-weight="800" fill="#ffffff">${escapeXml(initials)}</text>
  </g>

  <!-- Headline -->
  <text x="600" y="470" text-anchor="middle"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="52" font-weight="800" fill="#ffffff">
    Accept your invite to my Pactara group!
  </text>

  <!-- Subhead -->
  <text x="600" y="525" text-anchor="middle"
        font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="28" font-weight="500" fill="#9CA3AF">
    ${escapeXml(firstName)} invited you to join ${escapeXml(groupName)}
  </text>

  <!-- Footer pill -->
  <g transform="translate(600 585)">
    <rect x="-170" y="-28" width="340" height="56" rx="28" fill="#FDE047"/>
    <text x="0" y="2" text-anchor="middle" dominant-baseline="central"
          font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-size="24" font-weight="800" fill="#000000">Add me on Pactara</text>
  </g>
</svg>`;

        return new Response(svg, {
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=3600",
          },
        });
      },
    },
  },
});
