import { TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCountingTiyin } from '../../lib/motion';
import { CURRENCY, formatAmountNumber, MINUS, NBSP, signOf, TONE_CLASS, toneOf, type AmountTone } from '../../lib/money';

export interface AmountProps {
  /** Tiyin, as the API returns it. */
  value: string | bigint;
  /** Ledger type (INCOME, TRANSFER_OUT, LOAN_GIVEN…): decides sign and colour. */
  type?: string;
  /** Explicit tone when there is no ledger type (e.g. a KPI). */
  tone?: AmountTone;
  /** false hides the +/− (balances, totals). Negative balances keep their minus. */
  showSign?: boolean;
  /** Renders "so‘m" as a separate muted unit (big numbers) instead of inline text. */
  unit?: 'inline' | 'muted' | 'none';
  className?: string;
  unitClassName?: string;
}

function toTiyin(value: string | bigint): bigint {
  try {
    return typeof value === 'bigint' ? value : BigInt(value);
  } catch {
    return 0n;
  }
}

/** An Amount that counts up to its value when it appears or changes (KPI figures). */
export function CountingAmount(props: AmountProps) {
  const shown = useCountingTiyin(toTiyin(props.value));
  return <Amount {...props} value={shown} />;
}

/**
 * Money on screen. The sign and the icon carry the meaning; colour only reinforces it:
 * income "+" green, expense "−" red, transfers and debt movements unsigned, a negative balance
 * red with "−" and a warning icon.
 */
export function Amount({
  value,
  type,
  tone,
  showSign = true,
  unit = 'inline',
  className,
  unitClassName,
}: AmountProps) {
  const tiyin = toTiyin(value);
  const resolvedTone: AmountTone = type ? toneOf(type) : tone ?? 'neutral';
  const negativeBalance = !type && tiyin < 0n;

  let prefix = '';
  if (negativeBalance) prefix = MINUS;
  else if (showSign) {
    const sign = signOf(resolvedTone);
    prefix = sign === '+' ? '+' : sign === '-' ? MINUS : '';
  }

  const number = `${prefix}${formatAmountNumber(tiyin)}`;
  const colour = negativeBalance ? 'text-danger' : TONE_CLASS[resolvedTone];

  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap font-semibold tabular-nums', colour, className)}>
      {negativeBalance && <TriangleAlert className="h-[0.95em] w-[0.95em] shrink-0" aria-label="Manfiy balans" />}
      <span>
        {number}
        {unit === 'inline' && `${NBSP}${CURRENCY}`}
        {unit === 'muted' && (
          <>
            {NBSP}
            <span className={cn('text-[14px] font-medium tracking-normal text-text-muted', unitClassName)}>{CURRENCY}</span>
          </>
        )}
      </span>
    </span>
  );
}
