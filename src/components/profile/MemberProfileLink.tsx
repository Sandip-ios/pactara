import { Link } from "@tanstack/react-router";

/** Wraps a member avatar so tapping it opens that member's profile. */
export function MemberProfileLink({
  userId,
  isYou,
  className,
  children,
}: {
  userId: string;
  isYou?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (isYou) {
    return (
      <Link to="/profile" className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/u/$userId" params={{ userId }} className={className}>
      {children}
    </Link>
  );
}
