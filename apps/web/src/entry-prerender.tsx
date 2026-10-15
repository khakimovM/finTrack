import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LandingPage } from './pages/landing/LandingPage';

/**
 * The landing page as plain HTML, rendered at build time (scripts/prerender.mjs) into index.html:
 * search engines and link previews read the real page without running JavaScript, and visitors
 * see it before the app's script arrives. The app then draws the same page over it.
 */
export function renderLanding(): string {
  // No session is known at build time: the page renders for a signed-out visitor.
  const queryClient = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <StaticRouter location="/">
        <LandingPage />
      </StaticRouter>
    </QueryClientProvider>,
  );
}
