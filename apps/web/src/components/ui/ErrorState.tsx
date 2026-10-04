import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

export interface ErrorStateProps {
  /** "Tranzaksiyalarni yuklab bo‘lmadi". */
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** page: centred in a list; widget: one card failed, the rest of the page still works. */
  variant?: 'page' | 'widget';
  className?: string;
}

export function ErrorState({
  title = 'Maʼlumotlarni yuklab bo‘lmadi',
  message = 'Internet aloqasini tekshirib, qayta urinib ko‘ring.',
  onRetry,
  variant = 'page',
  className,
}: ErrorStateProps) {
  const widget = variant === 'widget';
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        widget ? 'min-h-[200px] gap-2 rounded-[14px] bg-surface px-4 py-6' : 'gap-2.5 px-4 py-14',
        className,
      )}
    >
      <div
        className={cn(
          'mb-1 flex items-center justify-center bg-danger-soft text-danger',
          widget ? 'h-11 w-11 rounded-md' : 'h-14 w-14 rounded-lg',
        )}
      >
        <TriangleAlert className={widget ? 'h-5 w-5' : 'h-6 w-6'} strokeWidth={1.8} aria-hidden />
      </div>
      <h3 className={cn('font-semibold text-text', widget ? 'text-[15px]' : 'text-[16px] leading-6')}>{title}</h3>
      <p className="max-w-[340px] text-[14px] leading-5 text-text-muted">{message}</p>
      {onRetry && (
        <Button variant="outline" size={widget ? 'sm' : 'md'} onClick={onRetry} className="mt-2">
          <RotateCcw className="h-4 w-4" aria-hidden />
          Qayta urinish
        </Button>
      )}
    </div>
  );
}
