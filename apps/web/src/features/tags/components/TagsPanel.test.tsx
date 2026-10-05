import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { TagsPanel } from './TagsPanel';
import { renderWithProviders } from '../../../test/render';
import { ok, server } from '../../../test/server';
import { tag } from '../../../test/fixtures';

const family = tag({ name: 'oila', transactionCount: 14 });
const work = tag({ name: 'ish', transactionCount: 3, color: '#e0a11b' });

function setup(newTagSignal = 0) {
  const props = { onOpen: vi.fn(), onDelete: vi.fn() };
  renderWithProviders(<TagsPanel tags={[family, work]} compact={false} newTagSignal={newTagSignal} {...props} />);
  return props;
}

describe('TagsPanel', () => {
  it('shows each tag with its usage and opens its transactions', async () => {
    const props = setup();
    expect(screen.getByText('14 ta tranzaksiya')).toBeTruthy();
    await userEvent.click(screen.getByText('#ish'));
    expect(props.onOpen).toHaveBeenCalledWith(work);
  });

  it('creates a tag: lowercase, without the #', async () => {
    let posted: unknown;
    server.use(
      http.post('*/api/v1/tags', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(ok(tag({ name: 'sayohat' })), { status: 201 });
      }),
    );
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Yangi teg' }));
    await userEvent.type(screen.getByLabelText('Teg nomi'), '#Sayohat');
    await userEvent.click(screen.getByRole('radio', { name: 'Binafsha' }));
    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }));

    await waitFor(() => expect(posted).toEqual({ name: 'sayohat', color: '#8a63d2' }));
  });

  it('refuses a name another tag has, before asking the API', async () => {
    setup(1);
    await userEvent.type(screen.getByLabelText('Teg nomi'), 'OILA{Enter}');
    expect(screen.getByRole('alert').textContent).toBe('Bunday teg allaqachon mavjud');
  });

  it('renames a tag in place', async () => {
    let patched: unknown;
    server.use(
      http.patch(`*/api/v1/tags/${work.id}`, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json(ok(work));
      }),
    );
    setup();
    const card = screen.getByText('#ish').closest('div[class*="rounded-2xl"]') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Tahrirlash' }));
    const input = screen.getByLabelText('Teg nomi');
    await userEvent.clear(input);
    await userEvent.type(input, 'ishxona{Enter}');

    await waitFor(() => expect(patched).toEqual({ name: 'ishxona', color: '#e0a11b' }));
  });
});
