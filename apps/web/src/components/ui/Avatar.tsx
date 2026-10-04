import { cn } from '../../lib/utils';

/** "Dilnoza Rahimova" → "DR", "Aziz" → "A". */
export function initialsOf(name: string, max = 2): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts
    .slice(0, max)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

const SIZE = {
  36: 'h-9 w-9 text-[13px]',
  40: 'h-10 w-10 text-[16px]',
  44: 'h-11 w-11 text-[16px]',
  56: 'h-14 w-14 text-[20px]',
} as const;

export interface AvatarProps {
  name: string;
  size?: keyof typeof SIZE;
  /** debt: people who owe the user, in the debt colour. */
  tone?: 'neutral' | 'debt';
  /** How many initials: 1 for the user, 2 for debt contacts. */
  letters?: 1 | 2;
  className?: string;
}

export function Avatar({ name, size = 40, tone = 'neutral', letters = 1, className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        SIZE[size],
        tone === 'debt' ? 'bg-debt-soft text-debt' : 'bg-secondary text-text-secondary',
        className,
      )}
    >
      {initialsOf(name, letters)}
    </span>
  );
}
