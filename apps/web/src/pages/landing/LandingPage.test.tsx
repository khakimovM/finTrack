import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { LandingPage, LandingRoute } from './LandingPage';
import { landingHead, renderLanding } from '../../entry-prerender';
import { renderWithProviders } from '../../test/render';
import { inRussian, latinLeftovers } from '../../test/russian';
import { fail, server } from '../../test/server';
import { useLocaleStore } from '../../stores/localeStore';
import { queryKeys } from '../../lib/queryKeys';

/** Data and names the Russian page keeps in Latin: the bot's handle, a card brand, the other language. */
const LATIN_ON_PURPOSE = ['fintrack_cwa_bot', 'Humo', 'O‘zbekcha'];

function signedOut() {
  server.use(
    http.get('*/api/v1/auth/me', () => HttpResponse.json(fail('UNAUTHORIZED'), { status: 401 })),
    http.post('*/api/v1/auth/refresh', () => HttpResponse.json(fail('UNAUTHORIZED'), { status: 401 })),
  );
}

/** The session probe has failed and its refresh attempt is over, so no request outlives the test. */
async function settled(queryClient: QueryClient) {
  await waitFor(() => expect(queryClient.getQueryState(queryKeys.auth.me())?.status).toBe('error'));
}

function Where() {
  return <output aria-label="address">{useLocation().pathname}</output>;
}

afterEach(() => localStorage.clear());

describe('landing page in Russian', () => {
  it('leaves no Uzbek on the page, the phone menu included', async () => {
    signedOut();
    inRussian();
    const { queryClient } = renderWithProviders(<LandingPage />, { route: '/ru' });
    await settled(queryClient);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Знайте, куда уходят ваши деньги — на сайте и в Telegram');
    expect(screen.getByRole('button', { name: 'Можно пользоваться без Telegram?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
    expect(screen.getByRole('group', { name: 'Язык' })).toBeTruthy();
    expect(latinLeftovers(LATIN_ON_PURPOSE)).toEqual([]);
  });
});

describe('the two landing addresses', () => {
  function renderBoth(route: string) {
    signedOut();
    return renderWithProviders(
      <>
        <Routes>
          <Route path="/" element={<LandingRoute lang="uz" />} />
          <Route path="/ru" element={<LandingRoute lang="ru" />} />
        </Routes>
        <Where />
      </>,
      { route },
    );
  }

  it('sends a visitor who chose Russian from "/" on to "/ru"', async () => {
    inRussian();
    await settled(renderBoth('/').queryClient);
    expect(screen.getByLabelText('address').textContent).toBe('/ru');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Знайте, куда уходят ваши деньги');
  });

  it('switches language with a link to the other address, and remembers the choice', async () => {
    await settled(renderBoth('/').queryClient);
    const toRussian = screen.getAllByRole('link', { name: 'Русский' })[0];
    expect(toRussian.getAttribute('href')).toBe('/ru');
    expect(toRussian.getAttribute('hreflang')).toBe('ru');

    fireEvent.click(toRussian);
    expect(screen.getByLabelText('address').textContent).toBe('/ru');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Знайте, куда уходят ваши деньги');
    expect(localStorage.getItem('fintrack.locale')).toBe('ru');

    fireEvent.click(screen.getAllByRole('link', { name: 'O‘zbekcha' })[0]);
    expect(screen.getByLabelText('address').textContent).toBe('/');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Pulingiz qayerga ketayotganini biling');
    expect(useLocaleStore.getState().locale).toBe('uz');
  });
});

describe('the prerendered pages', () => {
  it('draws each language for the build', () => {
    expect(renderLanding('ru')).toContain('Знайте, куда уходят ваши деньги');
    expect(renderLanding('uz')).toContain('Pulingiz qayerga ketayotganini biling');
  });

  it('index.html carries the Uzbek head texts the build writes from the dictionary', () => {
    // The dev server serves index.html as it is; the build puts the dictionary's texts in its place.
    const source = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    const { path, ...texts } = landingHead('uz');
    expect(path).toBe('/');
    for (const text of Object.values(texts)) expect(source).toContain(text);
  });
});
