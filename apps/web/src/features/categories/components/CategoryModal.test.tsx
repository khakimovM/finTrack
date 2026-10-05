import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { CategoryResponse } from '@fintrack/shared';
import { CategoryModal, type CategoryModalProps } from './CategoryModal';
import { renderWithProviders } from '../../../test/render';
import { fail, ok, server } from '../../../test/server';
import { category } from '../../../test/fixtures';

const taxi = category({ name: 'Taksi', parentId: '00000000-0000-4000-8000-0000000000aa' });
const transport = category({ id: '00000000-0000-4000-8000-0000000000aa', name: 'Transport', color: '#3d7bd6', children: [taxi] });
const food = category({ name: 'Oziq-ovqat' });
const salary = category({ name: 'Oylik', type: 'INCOME' });

function Harness(props: Omit<CategoryModalProps, 'isOpen' | 'onClose'>) {
  const [open, setOpen] = useState(true);
  return open ? <CategoryModal isOpen onClose={() => setOpen(false)} {...props} /> : <p>yopildi</p>;
}

function serveTree(onPost?: (body: unknown) => Response | undefined) {
  server.use(
    http.get('*/api/v1/categories', () => HttpResponse.json(ok([transport, food, salary]))),
    http.post('*/api/v1/categories', async ({ request }) => {
      const body = await request.json();
      return onPost?.(body) ?? HttpResponse.json(ok(category()), { status: 201 });
    }),
  );
}

describe('CategoryModal', () => {
  it('adds a subcategory under its parent, in the parent’s colour', async () => {
    let posted: unknown;
    serveTree((body) => {
      posted = body;
      return undefined;
    });
    renderWithProviders(<Harness defaultParentId={transport.id} />);

    expect(await screen.findByRole('heading', { name: 'Yangi subkategoriya' })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('radio', { name: /Transport/ }).getAttribute('aria-checked')).toBe('true'));
    await userEvent.type(screen.getByLabelText('Kategoriya nomi'), 'Metro');
    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(posted).toMatchObject({ name: 'Metro', type: 'EXPENSE', parentId: transport.id, color: '#3d7bd6' }));
  });

  it('offers only parents of the same type', async () => {
    serveTree();
    renderWithProviders(<Harness defaultType="INCOME" />);
    expect(await screen.findByRole('radio', { name: /Oylik/ })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Transport/ })).toBeNull();
  });

  it('keeps a parent with subcategories at the top level', async () => {
    serveTree();
    renderWithProviders(<Harness initialCategory={transport as CategoryResponse} />);

    expect(await screen.findByText('Subkategoriyasi bor kategoriyani boshqasiga ko‘chirib bo‘lmaydi')).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: /Oziq-ovqat/ }));
    expect(screen.getByRole('alert').textContent).toContain('Kategoriyalar faqat ikki darajali bo‘lishi mumkin');
    expect(screen.getByRole('radio', { name: /Asosiy/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('shows a taken name next to the field', async () => {
    serveTree(() => HttpResponse.json(fail('CATEGORY_EXISTS'), { status: 409 }));
    renderWithProviders(<Harness />);

    await userEvent.type(await screen.findByLabelText('Kategoriya nomi'), 'Oziq-ovqat');
    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Bunday nomli kategoriya allaqachon mavjud');
  });
});
