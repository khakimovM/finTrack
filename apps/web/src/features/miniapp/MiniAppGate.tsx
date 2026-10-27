import { Ban, Clock, CloudOff, PanelBottom, UserPlus, type LucideIcon } from 'lucide-react';
import { MiniAppStatus } from '../../stores/miniAppStore';
import { telegramApp } from '../../lib/telegram';
import { isAdminPath } from '../../lib/adminMiniApp';
import { cn } from '../../lib/utils';
import { t, type TextKey } from '../../lib/i18n';

type GateStatus = Exclude<MiniAppStatus, 'off' | 'ready'>;

const COPY: Record<GateStatus, { title: TextKey; body: TextKey; icon: LucideIcon; tile: string }> = {
  unregistered: {
    title: 'miniApp.gate.unregistered.title',
    body: 'miniApp.gate.unregistered.body',
    icon: UserPlus,
    tile: 'bg-info-soft text-info',
  },
  banned: {
    title: 'miniApp.gate.banned.title',
    body: 'miniApp.gate.banned.body',
    icon: Ban,
    tile: 'bg-danger-soft text-danger',
  },
  expired: {
    title: 'miniApp.gate.expired.title',
    body: 'miniApp.gate.expired.body',
    icon: Clock,
    tile: 'bg-warning-soft text-warning',
  },
  'no-init-data': {
    title: 'miniApp.gate.noInitData.title',
    body: 'miniApp.gate.noInitData.body',
    icon: PanelBottom,
    tile: 'bg-secondary text-text',
  },
  error: {
    title: 'miniApp.gate.error.title',
    body: 'miniApp.gate.error.body',
    icon: CloudOff,
    tile: 'bg-danger-soft text-danger',
  },
};

/** The admin panel (the bot's /admin button) is reopened from its own command, not "Ilova"; it is Uzbek only. */
const ADMIN_COPY: Partial<Record<GateStatus, { title: string; body: string }>> = {
  expired: {
    title: 'Admin panelni qayta oching',
    body: 'Xavfsizlik uchun har bir ochilish bir marta kirish beradi. Botga /admin yozing va panelni qayta oching.',
  },
  'no-init-data': {
    title: 'Panelni bot orqali oching',
    body: 'Botga /admin yozing va “🛡 Admin panelni ochish” tugmasini bosing.',
  },
};

/** Shown inside Telegram instead of the login page, which cannot work there. */
export function MiniAppGate({ status }: { status: GateStatus }) {
  const base = COPY[status];
  const admin = isAdminPath(window.location.pathname) ? ADMIN_COPY[status] : undefined;
  const copy = { ...base, title: admin?.title ?? t(base.title), body: admin?.body ?? t(base.body) };
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
            {retry ? t('common.retry') : t('miniApp.backToBot')}
          </button>
        </div>
      )}
    </div>
  );
}
