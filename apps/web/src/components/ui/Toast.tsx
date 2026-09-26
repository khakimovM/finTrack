import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, ToastItem } from '../../stores/toastStore';
import { cn } from '../../lib/utils';

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';

  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-top-2',
        isSuccess && 'bg-surface/95 border-success/30 text-foreground',
        isError && 'bg-surface/95 border-destructive/40 text-foreground',
        isWarning && 'bg-surface/95 border-warning/40 text-foreground',
        !isSuccess && !isError && !isWarning && 'bg-surface/95 border-border text-foreground',
      )}
    >
      <div className="shrink-0 mt-0.5">
        {isSuccess && <CheckCircle2 className="h-5 w-5 text-success" />}
        {isError && <AlertCircle className="h-5 w-5 text-destructive" />}
        {isWarning && <AlertTriangle className="h-5 w-5 text-warning" />}
        {!isSuccess && !isError && !isWarning && <Info className="h-5 w-5 text-primary" />}
      </div>

      <div className="flex-1 min-w-0">
        {toast.title && <p className="text-xs font-bold uppercase tracking-wider">{toast.title}</p>}
        <p className="text-sm font-medium leading-snug">{toast.message}</p>
      </div>

      <button
        onClick={onClose}
        className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Xabarni yopish"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
