import { LogoMark } from '../../components/brand/Logo';

/** Shown inside Telegram while the script loads and the launch data is exchanged for a session. */
export function MiniAppSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 bg-background pb-14 text-text" aria-busy="true">
      <div className="flex flex-col items-center gap-3.5">
        <LogoMark size={72} />
        <span className="text-[24px] font-semibold tracking-[-0.03em]">FinTrack</span>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div role="progressbar" aria-label="Kirilmoqda" className="h-1 w-[120px] overflow-hidden rounded-[9px] bg-secondary">
          <div className="h-full w-[40%] animate-ft-bar rounded-[9px] bg-brand" />
        </div>
        <span className="text-[13px] text-text-muted">Kirilmoqda…</span>
      </div>
    </div>
  );
}
