import { Check } from 'lucide-react';
import { APP_LOCALES, type AppLocale } from '@fintrack/shared';
import { cn } from '../../../lib/utils';
import { LANGUAGE_NAMES, useLocale, useT } from '../../../lib/i18n';
import { useLocaleStore } from '../../../stores/localeStore';
import { useUpdateProfile } from '../hooks/useSettings';
import { SettingsCard } from './ProfileSection';

/** The app's language. It is kept on the account too, so other devices and the bot follow it. */
export function LanguageSection() {
  const t = useT();
  const locale = useLocale();
  const setLocale = useLocaleStore((s) => s.setLocale);
  const update = useUpdateProfile();

  const choose = (next: AppLocale) => {
    if (next === locale) return;
    setLocale(next);
    update.mutate({ locale: next });
  };

  return (
    <SettingsCard title={t('language.title')} description={t('language.description')}>
      <div role="radiogroup" aria-label={t('language.title')} className="grid grid-cols-2 gap-2 sm:gap-3">
        {APP_LOCALES.map((value) => {
          const on = value === locale;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              lang={value}
              onClick={() => choose(value)}
              className={cn(
                'flex h-12 items-center justify-center gap-1.5 rounded-2xl border-[1.5px] bg-card text-[15px] focus-ring',
                on
                  ? 'border-ring font-semibold shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_22%,transparent)]'
                  : 'border-border font-medium',
              )}
            >
              {on && <Check className="h-3.5 w-3.5" aria-hidden />}
              {LANGUAGE_NAMES[value]}
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}
