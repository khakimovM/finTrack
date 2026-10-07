import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Menu, Send, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUiStore } from '../../stores/uiStore';
import { Logo } from '../../components/brand/Logo';
import { Collapse } from '../../components/ui/Collapse';
import { Segmented } from '../../components/ui/Segmented';
import { ThemeToggle } from '../../components/layout/ShellParts';

export const ANCHORS = [
  { href: '#imkoniyatlar', label: 'Imkoniyatlar' },
  { href: '#qanday-ishlaydi', label: 'Qanday ishlaydi' },
  { href: '#savollar', label: 'Savollar' },
] as const;

/** Sticky blurred bar: anchors and the theme toggle from 820px, a menu below. */
const press = 'transition-[background-color,transform] duration-fast ease-standard active:scale-[0.97] motion-reduce:active:scale-100';

/** The two menu icons swap with a quarter turn. */
const swap = 'absolute inset-0 h-[22px] w-[22px] transition-[opacity,transform] duration-base ease-standard motion-reduce:transition-none';

export function LandingHeader({ session }: { session: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { resolvedTheme, setTheme } = useUiStore();
  // A shadow once the page moves under the bar.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const cta = session ? (
    <Link
      to="/app"
      className={cn(
        'group inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3.5 text-[14px] font-medium text-primary-foreground hover:bg-primary-hover focus-ring min-[820px]:h-10 min-[820px]:pl-5 min-[820px]:pr-4',
        press,
      )}
    >
      Ilovaga o‘tish
      <ArrowRight
        className="hidden h-4 w-4 transition-transform duration-base ease-standard group-hover:translate-x-0.5 motion-reduce:transition-none min-[820px]:block"
        aria-hidden
      />
    </Link>
  ) : (
    <Link
      to="/login"
      className={cn(
        'inline-flex h-9 items-center rounded-full bg-primary px-4 text-[14px] font-medium text-primary-foreground hover:bg-primary-hover focus-ring min-[820px]:h-10 min-[820px]:px-5',
        press,
      )}
    >
      Kirish
    </Link>
  );

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-border bg-[color-mix(in_oklab,var(--background)_86%,transparent)] backdrop-blur-[14px] transition-shadow duration-base',
        scrolled && 'shadow-sm',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1232px] items-center gap-6 px-4">
        <Link to="/" className="rounded-md focus-ring" aria-label="FinTrack — bosh sahifa">
          <Logo size={32} wordmarkClassName="text-[19px]" />
        </Link>
        <nav className="hidden flex-1 items-center justify-center gap-1 min-[820px]:flex" aria-label="Sahifa bo‘limlari">
          {ANCHORS.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="flex h-9 items-center rounded-full px-3.5 text-[14px] font-medium text-text-secondary transition-colors duration-fast hover:bg-secondary hover:text-text focus-ring"
            >
              {a.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 min-[820px]:ml-0">
          <ThemeToggle className="hidden min-[820px]:flex" />
          {cta}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menyu"
            aria-expanded={menuOpen}
            className="-mr-1.5 flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary focus-ring min-[820px]:hidden"
          >
            <span className="relative h-[22px] w-[22px]" aria-hidden>
              <Menu className={cn(swap, menuOpen && 'rotate-90 scale-75 opacity-0')} />
              <X className={cn(swap, !menuOpen && '-rotate-90 scale-75 opacity-0')} />
            </span>
          </button>
        </div>
      </div>
      <Collapse open={menuOpen} className="min-[820px]:hidden">
        <div className="border-t border-border bg-background px-4 pb-5 pt-2">
          {ANCHORS.map((a) => (
            <a
              key={a.href}
              href={a.href}
              onClick={() => setMenuOpen(false)}
              className="flex h-[52px] items-center justify-between border-b border-border text-[17px] font-medium focus-ring"
            >
              {a.label}
              <ChevronRight className="h-[18px] w-[18px] text-text-muted" aria-hidden />
            </a>
          ))}
          <div className="flex h-[60px] items-center justify-between">
            <span className="text-[15px] text-text-secondary">Mavzu</span>
            <Segmented
              aria-label="Mavzu"
              value={resolvedTheme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Yorug‘' },
                { value: 'dark', label: 'Qorong‘i' },
              ]}
            />
          </div>
          <Link
            to="/login"
            className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-medium text-primary-foreground hover:bg-primary-hover focus-ring"
          >
            <Send className="h-[18px] w-[18px]" aria-hidden />
            Telegram orqali boshlash
          </Link>
        </div>
      </Collapse>
    </header>
  );
}
