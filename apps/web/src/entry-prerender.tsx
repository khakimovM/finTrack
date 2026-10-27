import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AppLocale } from '@fintrack/shared';
import { LandingPage } from './pages/landing/LandingPage';
import { translate } from './lib/i18n';
import { LANDING_PATH } from './lib/i18n/address';
import { useLocaleStore } from './stores/localeStore';

/**
 * The landing page as plain HTML, rendered at build time (scripts/prerender.mjs) into index.html
 * ("/", Uzbek) and ru.html ("/ru", Russian): search engines and link previews read the real page
 * without running JavaScript, and visitors see it before the app's script arrives. The app then
 * draws the same page over it.
 */
export function renderLanding(locale: AppLocale): string {
  useLocaleStore.getState().setLocale(locale);
  // No session is known at build time: the page renders for a signed-out visitor.
  const queryClient = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <StaticRouter location={LANDING_PATH[locale]}>
        <LandingPage />
      </StaticRouter>
    </QueryClientProvider>,
  );
}

/** The head texts of the landing page in one language, from the same dictionary as the page. */
export function landingHead(locale: AppLocale) {
  const text = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return {
    path: LANDING_PATH[locale],
    title: text('landing.meta.title'),
    description: text('landing.meta.description'),
    ogTitle: text('landing.meta.ogTitle'),
    ogDescription: text('landing.meta.ogDescription'),
    ogImageAlt: text('landing.meta.ogImageAlt'),
    twitterDescription: text('landing.meta.twitterDescription'),
    appDescription: text('landing.meta.appDescription'),
  };
}
