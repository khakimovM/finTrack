import { AlertTriangle, RefreshCw, Send, Wallet } from 'lucide-react';
import { MiniAppStatus } from '../../stores/miniAppStore';
import { telegramApp } from '../../lib/telegram';
import { Button } from '../../components/ui/Button';

const COPY: Record<Exclude<MiniAppStatus, 'off' | 'ready'>, { title: string; body: string }> = {
  unregistered: {
    title: 'Avval botda ro‘yxatdan o‘ting',
    body: 'Botga qaytib /start bosing va telefon raqamingizni ulashing. Shundan so‘ng ilovani qayta oching.',
  },
  expired: {
    title: 'Ilova sessiyasi tugadi',
    body: 'Xavfsizlik uchun ilova sessiyasi 24 soat amal qiladi. Ilovani botdagi “Ilova” tugmasi orqali qayta oching.',
  },
  'no-init-data': {
    title: 'Ilovani menyu tugmasi orqali oching',
    body: 'Botdagi “Ilova” tugmasi (xabar yozish maydoni yonida) yoki “🌐 FinTrack ilovasini ochish” tugmasidan foydalaning.',
  },
  error: {
    title: 'Ulanib bo‘lmadi',
    body: 'Server bilan bog‘lanishda xatolik yuz berdi. Birozdan so‘ng qayta urinib ko‘ring.',
  },
};

/** Shown inside Telegram instead of the login page, which cannot work there. */
export function MiniAppGate({ status }: { status: Exclude<MiniAppStatus, 'off' | 'ready'> }) {
  const copy = COPY[status];
  const app = telegramApp();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6 text-center text-foreground">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
        {status === 'error' ? (
          <AlertTriangle className="h-7 w-7" />
        ) : (
          <Wallet className="h-7 w-7" />
        )}
      </div>
      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-bold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
      </div>
      {status === 'error' ? (
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Qayta urinish
        </Button>
      ) : (
        app && (
          <Button onClick={() => app.close()}>
            <Send className="mr-2 h-4 w-4" />
            Botga qaytish
          </Button>
        )
      )}
    </div>
  );
}
