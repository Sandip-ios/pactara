import pactaraAppIconAsset from "@/assets/pactara-app-icon.png.asset.json";

const pactaraAppIcon = pactaraAppIconAsset.url;

/** The real Pactara app icon (plain white P on purple), clipped like an iOS icon rather than an avatar. */
export function PactaraAuthorIcon({ size }: { size: 16 | 24 }) {
  return (
    <img
      src={pactaraAppIcon}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-[22%] object-cover"
      aria-hidden
      data-pactara-author-icon
    />
  );
}
