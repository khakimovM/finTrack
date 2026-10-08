import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { LogoMark } from '../../../components/brand/Logo';
import { PublicHeader } from '../../../components/layout/PublicHeader';

/** The sign-in page frame: header, a centred card with the title, the flow, and the code warning. */
export function LoginCard({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  /** Next to the logo, e.g. the "Admin" mark. */
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-text">
      <PublicHeader back />
      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-4">
        <div className="flex w-full max-w-[440px] animate-ft-page-in flex-col gap-6 rounded-2xl border border-border bg-card px-5 pb-5 pt-6 shadow-sm sm:px-9 sm:pb-7 sm:pt-9">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <LogoMark size={48} />
              {badge}
            </div>
            <h1 className="mt-1 text-[26px] font-semibold leading-8 tracking-[-0.02em]">{title}</h1>
            <p className="text-text-secondary">{description}</p>
          </div>
          {children}
          <p className="flex items-start gap-2.5 border-t border-border pt-[18px] text-[13px] leading-[18px] text-text-muted">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            Kodni hech kimga bermang — FinTrack xodimlari uni hech qachon so‘ramaydi.
          </p>
        </div>
      </main>
    </div>
  );
}
