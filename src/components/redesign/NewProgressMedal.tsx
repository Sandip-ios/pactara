import type { CSSProperties } from 'react';
import { medalColor } from '@/lib/progress-view';

export function NewProgressMedal({ days, size = 56, className }: { days: number; size?: number; className?: string }) {
  const style = {
    background: medalColor(days),
    '--new-progress-medal-scale': size / 56,
  } as CSSProperties;
  return <span className={`new-progress-medal${className ? ` ${className}` : ''}`} style={style}>{days}</span>;
}
