import { cn } from '../../lib/utils';

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * Three shrinking bars: an "F" and a spending breakdown at once. Below 20px the bars thicken
 * (the design's 16px variant) so they stay visible.
 */
export function LogoMark({ size = 32, className }: LogoMarkProps) {
  const small = size < 20;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn('shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      {small ? (
        <>
          <rect x="7" y="7" width="18" height="5" rx="2.5" fill="var(--brand-foreground)" />
          <rect x="7" y="14" width="12" height="5" rx="2.5" fill="var(--brand-foreground)" />
          <rect x="7" y="21" width="5" height="5" rx="2.5" fill="var(--brand-foreground)" />
        </>
      ) : (
        <>
          <rect x="8" y="8" width="16" height="4.5" rx="2.25" fill="var(--brand-foreground)" />
          <rect x="8" y="14.5" width="10.5" height="4.5" rx="2.25" fill="var(--brand-foreground)" />
          <rect x="8" y="21" width="4.5" height="4.5" rx="2.25" fill="var(--brand-foreground)" />
        </>
      )}
    </svg>
  );
}

/** Bars only, for round avatars (Telegram crops to a circle; the bars sit in a 54% safe zone). */
export function LogoBars({ size = 17, className }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="8 8 16 17.5" className={className} aria-hidden="true">
      <rect x="8" y="8" width="16" height="4.5" rx="2.25" fill="var(--brand-foreground)" />
      <rect x="8" y="14.5" width="10.5" height="4.5" rx="2.25" fill="var(--brand-foreground)" />
      <rect x="8" y="21" width="4.5" height="4.5" rx="2.25" fill="var(--brand-foreground)" />
    </svg>
  );
}

interface LogoProps {
  /** Mark size; the wordmark scales with it (design lockups: 28/18, 30/18, 32/19, 72/24). */
  size?: number;
  wordmarkClassName?: string;
  className?: string;
}

export function Logo({ size = 32, wordmarkClassName, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <span className={cn('text-[18px] font-semibold tracking-[-0.02em] text-text', wordmarkClassName)}>
        FinTrack
      </span>
    </span>
  );
}
