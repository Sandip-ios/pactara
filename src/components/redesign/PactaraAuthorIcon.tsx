/** The real Pactara app icon (plain white P on purple), clipped like an iOS icon. */
export function PactaraAuthorIcon({ size }: { size: 16 | 24 }) {
  return (
    <img
      src="/pactara-icon-v2.png"
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-[22%] object-cover"
      aria-hidden
      data-pactara-author-icon
    />
  );
}
