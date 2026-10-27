import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../brand/Logo';
import { currentLocale, t } from '../../lib/i18n';
import { LANDING_PATH } from '../../lib/i18n/address';
import { LanguageSwitch } from './LanguageSwitch';

/**
 * Logo bar of the login and system pages; optionally a way back to the landing page and the
 * other language (not on the admin login, which is always Uzbek).
 */
export function PublicHeader({ back = false, language = false }: { back?: boolean; language?: boolean }) {
  const home = LANDING_PATH[currentLocale()];
  return (
    <header className="flex h-16 items-center justify-between px-4 sm:px-[clamp(16px,2.2vw,32px)]">
      <Link to={home} className="rounded-md focus-ring" aria-label={t('nav.homeLink')}>
        <Logo size={30} />
      </Link>
      <div className="flex items-center gap-1">
        {language && <LanguageSwitch />}
        {back && (
          <Link
            to={home}
            className="flex h-10 items-center gap-1.5 rounded-full pl-2.5 pr-3.5 text-[14px] font-medium text-text-secondary transition-colors duration-fast hover:bg-secondary hover:text-text focus-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('nav.home')}
          </Link>
        )}
      </div>
    </header>
  );
}
