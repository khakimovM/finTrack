import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message = 'Maʼlumotlarni yuklashda xatolik yuz berdi',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-3xl border border-destructive/20 bg-destructive/5',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive mb-3">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h4 className="text-sm font-bold text-foreground">Xatolik yuz berdi</h4>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Qayta urinish
        </Button>
      )}
    </div>
  );
}
