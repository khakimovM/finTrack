import * as React from 'react';
import { cn } from '../../lib/utils';
import { tintOf } from '../../lib/colors';

const SIZE: Record<number, { box: string; emoji: string }> = {
  28: { box: 'h-7 w-7 rounded-sm', emoji: 'text-[14px]' },
  30: { box: 'h-[30px] w-[30px] rounded-[9px]', emoji: 'text-[15px]' },
  32: { box: 'h-8 w-8 rounded-[9px]', emoji: 'text-[16px]' },
  34: { box: 'h-[34px] w-[34px] rounded-[11px]', emoji: 'text-[17px]' },
  40: { box: 'h-10 w-10 rounded-md', emoji: 'text-[19px]' },
  44: { box: 'h-11 w-11 rounded-md', emoji: 'text-[21px]' },
  48: { box: 'h-12 w-12 rounded-[14px]', emoji: 'text-[22px]' },
};

export interface EmojiTileProps {
  emoji?: React.ReactNode;
  /** Stored hex colour; the tile is its 16% tint. */
  color?: string | null;
  /** Fixed backgrounds for rows without a colour. */
  variant?: 'color' | 'transfer' | 'debt' | 'neutral';
  size?: 28 | 30 | 32 | 34 | 40 | 44 | 48;
  /** Archived items go grey. */
  muted?: boolean;
  className?: string;
}

/** Emoji on a tinted square: categories, accounts, budget rows, list rows. */
export function EmojiTile({ emoji, color, variant = 'color', size = 40, muted, className }: EmojiTileProps) {
  const s = SIZE[size];
  const background =
    variant === 'color' ? tintOf(color) : variant === 'debt' ? 'var(--debt-soft)' : 'var(--secondary)';
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center leading-none', s.box, s.emoji, muted && 'grayscale', className)}
      style={{ background }}
    >
      {emoji}
    </span>
  );
}
