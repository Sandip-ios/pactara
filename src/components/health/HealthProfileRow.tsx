import { Link } from '@tanstack/react-router';
import { Heart, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppleHealth } from '@/lib/use-apple-health';
export function HealthProfileRow() {
  const health = useAppleHealth();
  if (!health.available) return null;
  return <Button variant="ghost" asChild className="mt-3 h-12 w-full justify-between rounded-2xl bg-health-surface px-4 text-health-ink">
    <Link to="/apple-health"><span className="flex items-center gap-3"><Heart className="fill-health-heart text-health-heart" />Apple Health</span><ChevronRight /></Link>
  </Button>;
}