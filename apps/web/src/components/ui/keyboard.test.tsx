import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountPicker, CategoryPicker } from './EntityPickers';
import { Dropdown } from './Dropdown';
import { Modal } from './Modal';
import { setTouchScreen } from '../../test/viewport';

// iOS web views do not move focus to a tapped button, so these tests click with fireEvent (focus
// stays where it was) to see what the app itself does with the keyboard's field.

const CATEGORIES = [
  { id: 'food', name: 'Oziq-ovqat', icon: '🍔', color: '#ef4444', children: [{ id: 'lunch', name: 'Tushlik', icon: '🥪', color: '#ef4444' }] },
  { id: 'taxi', name: 'Transport', icon: '🚕', color: '#f97316' },
];
const ACCOUNTS = [
  { id: 'cash', name: 'Naqd pul', icon: '💵', color: '#10b981', balance: '500000' },
  { id: 'card', name: 'Kapitalbank', icon: '💳', color: '#3b82f6', balance: '4610000' },
];

function Form() {
  const [category, setCategory] = useState('food');
  const [account, setAccount] = useState('cash');
  const [sort, setSort] = useState('new');
  return (
    <>
      <label htmlFor="amount">Summa</label>
      <input id="amount" inputMode="decimal" />
      <AccountPicker label="Hisob" accounts={ACCOUNTS} value={account} onChange={setAccount} />
      <CategoryPicker label="Kategoriya" categories={CATEGORIES} value={category} onChange={setCategory} />
      <Dropdown
        label="Saralash"
        value={sort}
        onChange={setSort}
        options={[
          { value: 'new', label: 'Eng yangi' },
          { value: 'old', label: 'Eng eski' },
        ]}
      />
    </>
  );
}

describe('pickers and the on-screen keyboard', () => {
  it('on a phone opens the category list without the keyboard; a keyboard user still types to search at once', async () => {
    setTouchScreen(true);
    const { unmount } = render(<Form />);
    fireEvent.click(screen.getByRole('button', { name: /Kategoriya/ }));
    const search = await screen.findByRole('textbox', { name: 'Kategoriyani qidirish' });
    expect(document.activeElement).not.toBe(search);
    expect(screen.getByRole('option', { name: /Tushlik/ })).toBeTruthy();
    unmount();

    setTouchScreen(false);
    render(<Form />);
    fireEvent.click(screen.getByRole('button', { name: /Kategoriya/ }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Kategoriyani qidirish' })));
  });

  it('puts the keyboard away when a picker opens over the field that held it', () => {
    setTouchScreen(true);
    render(<Form />);
    const amount = screen.getByLabelText('Summa');

    for (const trigger of [
      screen.getByRole('button', { name: /Hisob/ }),
      screen.getByRole('button', { name: /Kategoriya/ }),
      screen.getByRole('combobox', { name: 'Saralash' }),
    ]) {
      amount.focus();
      fireEvent.click(trigger);
      expect(document.activeElement).not.toBe(amount);
      fireEvent.click(trigger);
    }
  });

  it('scrolls the field and its opened list into view', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<Form />);
      fireEvent.click(screen.getByRole('button', { name: /Hisob/ }));
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
      const revealed = scrollIntoView.mock.contexts.at(-1) as Element;
      expect(revealed.contains(screen.getByRole('button', { name: /Hisob/ }))).toBe(true);
      expect(within(revealed as HTMLElement).getByRole('listbox')).toBeTruthy();
    } finally {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
  });
});

describe('modals and the on-screen keyboard', () => {
  function Harness() {
    return (
      <Modal isOpen onClose={() => undefined} title="Yangi tranzaksiya" footer={<button type="button">Saqlash</button>}>
        <label htmlFor="note">Izoh</label>
        <input id="note" />
        <button type="button">Kirim</button>
        <p>Hisobda yetarli mablag‘ bor</p>
      </Modal>
    );
  }

  it('on a phone closes the keyboard on a tap outside the text fields and keeps it for the field and its label', () => {
    setTouchScreen(true);
    render(<Harness />);
    const note = screen.getByLabelText('Izoh');

    note.focus();
    fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));
    expect(document.activeElement).not.toBe(note);

    note.focus();
    fireEvent.pointerDown(screen.getByText('Hisobda yetarli mablag‘ bor'));
    expect(document.activeElement).not.toBe(note);

    note.focus();
    fireEvent.pointerDown(screen.getByText('Izoh'));
    fireEvent.pointerDown(note);
    fireEvent.click(note);
    expect(document.activeElement).toBe(note);
  });

  it('leaves focus alone with a mouse', async () => {
    render(<Harness />);
    const note = screen.getByLabelText('Izoh');
    note.focus();
    fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));
    expect(document.activeElement).toBe(note);
    // A real mouse click still moves focus to the button, as browsers do.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Saqlash' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Saqlash' }));
  });
});

describe('modals while the keyboard covers part of the screen', () => {
  class FakeViewport extends EventTarget {
    height = 400;
    offsetTop = 120;
    scale = 1;
  }

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: null });
  });

  it('fits the visible part of the screen, then the whole screen again when the keyboard closes', () => {
    const viewport = new FakeViewport();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    render(
      <Modal isOpen onClose={() => undefined} title="Yangi hisob">
        <input aria-label="Nomi" />
      </Modal>,
    );
    const frame = screen.getByRole('dialog').parentElement as HTMLElement;
    expect(frame.style.top).toBe('120px');
    expect(frame.style.height).toBe('400px');

    viewport.height = window.innerHeight;
    viewport.offsetTop = 0;
    act(() => {
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(frame.style.top).toBe('');
    expect(frame.style.height).toBe('');
  });

  it('ignores a pinch zoom, which shrinks the visible part too', () => {
    const viewport = new FakeViewport();
    viewport.scale = 2;
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    render(
      <Modal isOpen onClose={() => undefined} title="Yangi hisob">
        <input aria-label="Nomi" />
      </Modal>,
    );
    expect((screen.getByRole('dialog').parentElement as HTMLElement).style.height).toBe('');
  });
});
