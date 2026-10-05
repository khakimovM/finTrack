import { cn } from '../../lib/utils';
import { CHART_COLOR_NAMES, CHART_COLORS, chartIndexOf, tintOf } from '../../lib/colors';
import { Field } from './Field';

export interface EmojiGridProps {
  label?: string;
  emojis: readonly string[];
  value: string;
  onChange: (emoji: string) => void;
  /** Colour of the selected cell's tint. */
  color?: string | null;
  className?: string;
}

/** 42px cells; the chosen one takes the item colour's tint and a 1.5px ring. */
export function EmojiGrid({ label = 'Belgi', emojis, value, onChange, color, className }: EmojiGridProps) {
  return (
    <Field label={label} className={className}>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(42px,1fr))] gap-1">
        {emojis.map((emoji) => {
          const on = emoji === value;
          return (
            <button
              key={emoji}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={emoji}
              onClick={() => onChange(emoji)}
              className={cn(
                'flex h-[42px] items-center justify-center rounded-[10px] text-[20px] leading-none transition-colors duration-fast focus-ring',
                !on && 'hover:bg-secondary',
              )}
              style={
                on
                  ? { background: tintOf(color), boxShadow: `inset 0 0 0 1.5px ${color ? `var(--chart-${chartIndexOf(color) ?? 9})` : 'var(--ring)'}` }
                  : undefined
              }
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export interface SwatchesProps {
  label?: string;
  /** How many of the chart colours to offer: accounts 8, categories 9. */
  count?: 8 | 9;
  /** Stored hex; legacy colours are matched to their chart colour. */
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}

/** 40px buttons with a 30px dot; the chosen one gets a ring and a white check. */
export function Swatches({ label = 'Rang', count = 9, value, onChange, className }: SwatchesProps) {
  const selected = chartIndexOf(value);
  return (
    <Field label={label} className={className}>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {CHART_COLORS.slice(0, count).map((hex, i) => {
          const index = i + 1;
          const on = selected === index;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={CHART_COLOR_NAMES[i]}
              onClick={() => onChange(hex)}
              className="flex h-10 w-10 items-center justify-center rounded-full focus-ring"
              style={on ? { boxShadow: `inset 0 0 0 2px var(--chart-${index})` } : undefined}
            >
              <span
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[14px] font-bold text-white"
                style={{ background: `var(--chart-${index})` }}
              >
                {on ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}
