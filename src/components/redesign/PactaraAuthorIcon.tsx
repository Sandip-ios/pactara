import pactaraAppIcon from "../../../native-assets/ios/AppIcon-1024.png";

/** The native Pactara app icon, clipped like an iOS icon rather than an avatar. */
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
