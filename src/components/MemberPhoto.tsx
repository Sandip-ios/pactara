import { useState } from "react";

/** A failed photo must not hide the member's identity. A fresh URL retries it. */
export function MemberPhoto({ src, name }: { src?: string | null; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <>{(name || "U").slice(0, 1).toUpperCase()}</>;
  return (
    <img
      src={src}
      alt={name}
      className="h-full w-full object-cover"
      onError={() => setFailedSrc(src)}
    />
  );
}