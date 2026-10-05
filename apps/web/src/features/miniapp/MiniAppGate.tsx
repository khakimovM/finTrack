import { Clock, CloudOff, PanelBottom, UserPlus, type LucideIcon } from 'lucide-react';
import { MiniAppStatus } from '../../stores/miniAppStore';
import { telegramApp } from '../../lib/telegram';
import { cn } from '../../lib/utils';

type GateStatus = Exclude<MiniAppStatus, 'off' | 'ready'>;

const COPY: Record<GateStatus, { title: string; body: string; icon: LucideIcon; tile: string }> = {
  unregistered: {
    title: 'Avval botda ro‘yxatdan o‘ting',
    body: 'Botga qaytib /start bosing va telefon raqamingizni ulashing. Shundan so‘ng ilovani qayta oching.',
    icon: UserPlus,
    tile: 'bg-info-soft text-info',
  },
  expired: {
    title: 'Ilova sessiyasi tugadi',
    body: 'Xavfsizlik uchun ilova sessiyasi 24 soat amal qiladi. Ilovani botdagi “Ilova” tugmasi orqali qayta oching.',
    icon: Clock,
    tile: 'bg-warning-soft text-warning',
  },
  'no-init-data': {
    title: 'Ilovani menyu tugmasi orqali oching',
    body: 'Botdagi “Ilova” tugmasi (xabar yozish maydoni yonida) yoki “🌐 FinTrack ilovasini ochish” tugmasidan foydalaning.',
    icon: PanelBottom,
    tile: 'bg-secondary text-text',
  },
  error: {
    title: 'Ulanib bo‘lmadi',
    body: 'Server bilan bog‘lanishda xatolik yuz berdi. Birozdan so‘ng qayta urinib ko‘ring.',
    icon: CloudOff,
    tile: 'bg-danger-soft text-danger',
  },
};

/** Shown inside Telegram instead of the login page, which cannot work there. */
export function MiniAppGate({ status }: { status: GateStatus }) {
  const copy = COPY[status];
  const app = telegramApp();
  const retry = status === 'error';

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 text-text">
      <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-1 py-6 text-center">
        <span className={cn('flex h-[72px] w-[72px] items-center justify-center rounded-xl', copy.tile)}>
          <copy.icon className="h-8 w-8" strokeWidth={1.8} aria-hidden />
        </span>
        <h1 className="mt-2.5 text-[22px] font-semibold leading-7 tracking-[-0.01em] [text-wrap:balance]">{copy.title}</h1>
        <p className="max-w-[320px] text-[15px] leading-[22px] text-text-secondary">{copy.body}</p>
      </div>
      {(retry || app) && (
        <div className="pt-4" style={{ paddingBottom: 'calc(34px + env(safe-area-inset-bottom, 0px))' }}>
          <button
            type="button"
            onClick={() => (retry ? window.location.reload() : app?.close())}
            className="h-[52px] w-full rounded-full bg-primary text-[16px] font-medium text-primary-foreground hover:bg-primary-hover focus-ring"
          >
            {retry ? 'Qayta urinish' : 'Botga qaytish'}
          </button>
        </div>
      )}
    </div>
  );
}
