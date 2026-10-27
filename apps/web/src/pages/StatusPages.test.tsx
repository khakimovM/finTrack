import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { NotFoundPage } from './NotFoundPage';
import { MiniAppGate } from '../features/miniapp/MiniAppGate';
import { MiniAppSplash } from '../features/miniapp/MiniAppSplash';
import { renderWithProviders } from '../test/render';
import { inRussian, latinLeftovers } from '../test/russian';

describe('status screens in Russian', () => {
  it('writes the missing page in Russian', () => {
    inRussian();
    renderWithProviders(<NotFoundPage />);

    expect(screen.getByRole('heading', { name: 'Страница не найдена' })).toBeTruthy();
    expect(latinLeftovers()).toEqual([]);
  });

  it.each(['unregistered', 'banned', 'expired', 'no-init-data', 'error'] as const)('explains the Mini App state %s in Russian', (status) => {
    inRussian();
    renderWithProviders(<MiniAppGate status={status} />);

    expect(screen.getByRole('heading').textContent).toMatch(/[А-Яа-я]/);
    expect(latinLeftovers(['start', 'admin'])).toEqual([]);
  });

  it('signs in to the Mini App in Russian', () => {
    inRussian();
    renderWithProviders(<MiniAppSplash />);

    expect(screen.getByRole('progressbar', { name: 'Выполняется вход' })).toBeTruthy();
    expect(latinLeftovers()).toEqual([]);
  });
});
