import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { CategoriesPage } from './CategoriesPage';
import { renderWithProviders } from '../../test/render';
import { inRussian, latinLeftovers } from '../../test/russian';
import { ok, server } from '../../test/server';
import { category, tag } from '../../test/fixtures';

function serve() {
  server.use(
    http.get('*/api/v1/categories', () =>
      HttpResponse.json(ok([category({ name: 'Transport', children: [category({ name: 'Taksi' })] }), category({ name: 'Ish haqi', type: 'INCOME' })])),
    ),
    http.get('*/api/v1/tags', () => HttpResponse.json(ok([tag({ name: 'oila', transactionCount: 3 })]))),
  );
}

describe('CategoriesPage in Russian', () => {
  it('leaves no Uzbek in the tree and the tabs', async () => {
    inRussian();
    serve();
    renderWithProviders(<CategoriesPage />, { route: '/app/categories' });

    expect(await screen.findByText('Transport')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Расходы/ })).toBeTruthy();
    expect(latinLeftovers(['Transport', 'Taksi'])).toEqual([]);
  });

  it('leaves no Uzbek on the tags tab', async () => {
    inRussian();
    serve();
    renderWithProviders(<CategoriesPage />, { route: '/app/categories?tab=tags' });

    expect(await screen.findByText('#oila')).toBeTruthy();
    expect(screen.getByText('3 операции')).toBeTruthy();
    expect(latinLeftovers(['oila'])).toEqual([]);
  });
});
