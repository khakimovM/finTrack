import { Link } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { APP_LOCALES, type AppLocale } from '@fintrack/shared';
import { cn } from '../../lib/utils';
import { LANGUAGE_NAMES, t, useLocale } from '../../lib/i18n';
import { LANDING_PATH } from '../../lib/i18n/address';
import { useLocaleStore } from '../../stores/localeStore';

const OTHER: Record<AppLocale, AppLocale> = { uz: 'ru', ru: 'uz' };

/**
 * The other language, by its own name. On the landing page it is a link to that language's
 * address (search engines follow it to /ru); on other public pages it switches in place.
 */
export function LanguageSwitch({ landing = false, className }: { landing?: boolean; className?: string }) {
  const setLocale = useLocaleStore((s) => s.setLocale);
  const other = OTHER[useLocale()];
  const look = cn(
    'flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-text-secondary transition-colors duration-fast hover:bg-secondary hover:text-text focus-ring',
    className,
  );
  const label = (
    <>
      <Globe className="h-4 w-4" aria-hidden />
      {LANGUAGE_NAMES[other]}
    </>
  );
  if (!landing) {
    return (
      <button type="button" lang={other} onClick={() => setLocale(other)} className={look}>
        {label}
      </button>
    );
  }
  return (
    <Link to={LANDING_PATH[other]} replace hrefLang={other} lang={other} onClick={() => setLocale(other)} className={look}>
      {label}
    </Link>
  );
}

/** Both languages side by side (the landing page's phone menu), the current one raised. */
export function LanguageChoice() {
  const setLocale = useLocaleStore((s) => s.setLocale);
  const locale = useLocale();
  return (
    <div role="group" aria-label={t('language.title')} className="inline-flex gap-0.5 rounded-full bg-secondary p-1">
      {APP_LOCALES.map((value) => (
        <Link
          key={value}
          to={LANDING_PATH[value]}
          replace
          hrefLang={value}
          lang={value}
          aria-current={value === locale ? 'true' : undefined}
          onClick={() => setLocale(value)}
          className={cn(
            'flex h-9 items-center rounded-full px-4 text-[14px] font-medium transition-[background-color,color] duration-fast focus-ring',
            value === locale ? 'bg-card text-text shadow-sm' : 'text-text-secondary hover:text-text',
          )}
        >
          {LANGUAGE_NAMES[value]}
        </Link>
      ))}
    </div>
  );
}
