import * as React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Colour of the active label: Chiqim = expense, Kirim = income, Qarz = debt. */
  tone?: 'expense' | 'income' | 'debt';
}

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  'aria-label': string;
  /** sm 30 (chart toggles), md 36 (page level), lg 40 (forms). */
  size?: 'sm' | 'md' | 'lg';
  /** Locked when editing ("Tahrirlashda turini o‘zgartirib bo‘lmaydi"). */
  locked?: boolean;
  lockedHint?: string;
  fullWidth?: boolean;
  /** Tabs share the look; they announce themselves as tabs instead of radios. */
  role?: 'radiogroup' | 'tablist';
  className?: string;
}

const TONE: Record<NonNullable<SegmentedOption<string>['tone']>, string> = {
  expense: 'text-expense',
  income: 'text-income',
  debt: 'text-debt',
};

const SIZE = {
  sm: { track: 'p-[3px] gap-0.5', item: 'h-[30px] px-3 text-[13px] font-medium' },
  md: { track: 'p-1 gap-0.5', item: 'h-9 px-4 text-[14px] font-medium' },
  lg: { track: 'p-1 gap-1', item: 'h-10 px-4 text-[14px] font-semibold' },
} as const;

interface ThumbBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the active segment sits, so one card can slide between segments. Null until measured
 * (and in jsdom, which has no layout): the active button then draws its own card.
 */
function useThumb(
  refs: React.MutableRefObject<Array<HTMLButtonElement | null>>,
  activeIndex: number,
  count: number,
): { box: ThumbBox | null; slides: boolean } {
  const [box, setBox] = React.useState<ThumbBox | null>(null);
  // The first placement jumps; only later changes of the active segment slide.
  const [slides, setSlides] = React.useState(false);

  React.useLayoutEffect(() => {
    const measure = () => {
      const node = refs.current[activeIndex];
      if (!node || node.offsetWidth === 0) {
        setBox(null);
        return;
      }
      const next = { x: node.offsetLeft, y: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight };
      setBox((prev) =>
        prev && prev.x === next.x && prev.y === next.y && prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };
    measure();
    // Labels change width when the font loads or a count updates.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    refs.current.slice(0, count).forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, [refs, activeIndex, count]);

  React.useEffect(() => {
    if (!box || slides) return;
    const frame = requestAnimationFrame(() => setSlides(true));
    return () => cancelAnimationFrame(frame);
  }, [box, slides]);

  return { box, slides };
}

/** Track in secondary, the active segment lifts onto a card with shadow-sm. Arrow keys move. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  size = 'md',
  locked = false,
  lockedHint,
  fullWidth = false,
  role = 'radiogroup',
  className,
}: SegmentedProps<T>) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const isTabs = role === 'tablist';
  const s = SIZE[size];
  const activeIndex = options.findIndex((option) => option.value === value);
  const thumb = useThumb(refs, activeIndex, options.length);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step || locked) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className={cn('flex min-w-0 max-w-full flex-col gap-1.5', fullWidth ? 'w-full' : 'items-start', className)}>
      <div
        role={role}
        aria-label={ariaLabel}
        aria-disabled={locked || undefined}
        className={cn(
          'scrollbar-none relative inline-flex max-w-full overflow-x-auto rounded-full bg-secondary',
          s.track,
          fullWidth && 'flex w-full',
          locked && 'cursor-not-allowed opacity-55',
        )}
      >
        {thumb.box && (
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute left-0 top-0 rounded-full bg-card shadow-sm',
              thumb.slides && 'transition-[transform,width,height] duration-base ease-standard motion-reduce:transition-none',
            )}
            style={{
              width: thumb.box.width,
              height: thumb.box.height,
              transform: `translate(${thumb.box.x}px, ${thumb.box.y}px)`,
            }}
          />
        )}
        {options.map((option, index) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role={isTabs ? 'tab' : 'radio'}
              aria-checked={isTabs ? undefined : active}
              aria-selected={isTabs ? active : undefined}
              tabIndex={active ? 0 : -1}
              disabled={locked}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full transition-[background-color,color,box-shadow] duration-fast focus-ring disabled:cursor-not-allowed',
                s.item,
                fullWidth && 'flex-1',
                active
                  ? cn(!thumb.box && 'bg-card shadow-sm', option.tone ? TONE[option.tone] : 'text-text')
                  : isTabs
                    ? 'text-text hover:bg-secondary-hover'
                    : 'text-text-secondary hover:text-text',
              )}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>
      {locked && lockedHint && (
        <span className="flex items-center gap-1.5 text-[12.5px] text-text-muted">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          {lockedHint}
        </span>
      )}
    </div>
  );
}
