import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { useToastStore, type ToastItem } from '../../stores/toastStore';
import { cn } from '../../lib/utils';

const ICON = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
} as const;

/**
 * Bottom-centre stack. The app shell lifts it above the phone tab bar through --toast-bottom.
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-4"
      style={{ bottom: 'calc(var(--toast-bottom, 24px) + env(safe-area-inset-bottom, 0px))' }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const Icon = ICON[toast.type];
  const isError = toast.type === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className="pointer-events-auto relative w-max max-w-full animate-ft-toast-in overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-lg"
    >
      <div className="flex min-h-[52px] items-center gap-3 py-2.5 pl-4 pr-2.5">
        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
        <p className="min-w-0 text-[14px] font-medium leading-5">
          {toast.title && <span className="font-semibold">{toast.title}: </span>}
          {toast.message}
        </p>
        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            className="h-[34px] shrink-0 rounded-full px-3.5 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
            style={{ background: 'color-mix(in oklab, var(--primary-foreground) 16%, transparent)' }}
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Xabarni yopish"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {toast.action && toast.durationMs > 0 && (
        <div
          className="h-[3px] w-full"
          style={{ background: 'color-mix(in oklab, var(--primary-foreground) 14%, transparent)' }}
          aria-hidden
        >
          <div
            className={cn('h-full origin-left bg-primary-foreground opacity-60')}
            style={{ animation: `ft-shrink ${toast.durationMs}ms linear forwards` }}
          />
        </div>
      )}
    </div>
  );
}
