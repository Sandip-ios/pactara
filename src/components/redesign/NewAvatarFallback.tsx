/** Full-disc silhouette shared by every new-version no-photo avatar. */
export function NewAvatarFallback() {
  return <svg viewBox="0 0 100 100" className="new-avatar-fallback" aria-hidden="true">
    <circle cx="50" cy="39" r="17" />
    <ellipse cx="50" cy="97" rx="35" ry="32" />
  </svg>;
}