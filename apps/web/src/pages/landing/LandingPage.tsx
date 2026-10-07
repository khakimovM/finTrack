import { useEffect } from 'react';
import { Lock } from 'lucide-react';
import { useSessionQuery } from '../../features/auth/hooks/useSession';
import { LandingHeader } from '../../features/landing/LandingHeader';
import { HeroVisual } from '../../features/landing/HeroVisual';
import { TelegramBand } from '../../features/landing/TelegramBand';
import { CtaButtons, Faq, Features, FinalCta, LandingFooter, SecurityBand, Steps } from '../../features/landing/Sections';
import { useEntrance } from '../../features/landing/reveal';
import { useReducedMotion } from '../../lib/motion';

/** The front door: what FinTrack does, how the bot works, and the way in (Telegram only). */
export function LandingPage() {
  const session = useSessionQuery();
  const at = useEntrance();
  const reduced = useReducedMotion();

  // Anchor links glide to their section here; app pages keep instant scroll restoration.
  useEffect(() => {
    if (reduced) return;
    const root = document.documentElement;
    root.style.scrollBehavior = 'smooth';
    return () => {
      root.style.scrollBehavior = '';
    };
  }, [reduced]);

  const title = at(60, 'text-[clamp(38px,4.6vw,64px)] font-semibold leading-[1.06] tracking-[-0.035em] [text-wrap:balance]');
  const lead = at(160, 'max-w-[480px] text-[clamp(16px,1.35vw,19px)] leading-[1.5] text-text-secondary');
  const ctas = at(260);
  const note = at(360, 'flex items-center gap-2 text-[13px] text-text-muted');

  return (
    <div className="min-h-screen bg-background text-text">
      <LandingHeader session={Boolean(session.data)} />
      <main>
        <section className="overflow-hidden">
          <div className="mx-auto flex max-w-[1232px] flex-wrap items-center gap-12 px-4 pb-12 pt-8 min-[820px]:pb-[clamp(48px,6vw,96px)] min-[820px]:pt-[clamp(32px,6vw,88px)]">
            <div className="relative z-[2] flex max-w-[540px] flex-[1_1_420px] flex-col gap-6">
              <h1 className={title.className} style={title.style}>
                Pulingiz qayerga ketayotganini biling{' '}
                <span className="text-text-muted">— saytda ham, Telegram’da ham</span>
              </h1>
              <p className={lead.className} style={lead.style}>
                Xarajatni botga bir jumla bilan yozing yoki saytda kiriting. FinTrack har bir so‘mni kategoriyaga ajratadi,
                byudjet va qarzlarni kuzatib boradi.
              </p>
              <CtaButtons className={ctas.className} style={ctas.style} />
              <p className={note.className} style={note.style}>
                <Lock className="h-[15px] w-[15px]" aria-hidden />
                Parol kerak emas · Kod Telegram’ga keladi
              </p>
            </div>
            <HeroVisual />
          </div>
        </section>
        <Features />
        <TelegramBand />
        <Steps />
        <SecurityBand />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
