import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ErrorState } from '../../../components/ui/ErrorState';

interface WidgetCardProps {
  title: string;
  /** "Barchasi" link to the full page. */
  to?: string;
  /** Header content right of the title (legend, stats). */
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A dashboard card: 16/24 title, optional "Barchasi", flat border, padding 16 → 20/24. */
export function WidgetCard({ title, to, extra, className, children }: WidgetCardProps) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:px-6 sm:py-5', className)}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h2 className="text-[16px] font-semibold leading-6">{title}</h2>
        {extra}
        {to && (
          <Link
            to={to}
            className="-mr-2 flex h-8 items-center gap-0.5 rounded-full px-3 text-[13px] font-medium text-text-secondary transition-colors duration-fast hover:bg-secondary hover:text-text focus-ring"
          >
            Barchasi <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

interface WidgetStateProps {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  skeleton: ReactNode;
  errorTitle?: string;
  children: ReactNode;
}

/** One failing widget shows its own error and retry; the rest of the page keeps working. */
export function WidgetState({ isLoading, isError, onRetry, skeleton, errorTitle = 'Grafikni yuklab bo‘lmadi', children }: WidgetStateProps) {
  if (isLoading) return <>{skeleton}</>;
  if (isError) {
    return (
      <ErrorState
        variant="widget"
        title={errorTitle}
        message="Boshqa bo‘limlar ishlayapti. Faqat shu qismni qayta yuklang."
        onRetry={onRetry}
      />
    );
  }
  return <>{children}</>;
}
