import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown } from './Dropdown';
import { MoneyInput } from './MoneyInput';
import { RangePicker } from './RangePicker';
import { Modal } from './Modal';
import { Segmented } from './Segmented';
import { pageWindow } from './Pagination';
import { ToastContainer } from './Toast';
import { toast, useToastStore } from '../../stores/toastStore';
import { NBSP } from '../../lib/money';

describe('Dropdown', () => {
  function Harness() {
    const [value, setValue] = useState('');
    return (
      <>
        <Dropdown
          label="Saralash"
          value={value}
          onChange={setValue}
          placeholder="Tanlang"
          options={[
            { value: 'new', label: 'Eng yangi' },
            { value: 'old', label: 'Eng eski' },
            { value: 'big', label: 'Eng katta summa', disabled: true },
            { value: 'small', label: 'Eng kichik summa' },
          ]}
        />
        <output data-testid="value">{value}</output>
      </>
    );
  }

  it('opens with the keyboard, skips disabled options and selects with Enter', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('combobox', { name: 'Saralash' });

    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeTruthy();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(screen.getByTestId('value').textContent).toBe('small');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger.textContent).toContain('Eng kichik summa');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Escape and on a click outside without changing the value', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('combobox', { name: 'Saralash' });

    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByTestId('value').textContent).toBe('');
  });
});

describe('MoneyInput', () => {
  function Harness({ initial = '0' }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return (
      <>
        <MoneyInput
          label="Summa"
          value={value}
          onChange={setValue}
          chips={[{ label: 'Hammasi · 900 000', value: '90000000' }]}
        />
        <output data-testid="tiyin">{value}</output>
      </>
    );
  }

  it('groups thousands as you type and reports tiyin', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Summa') as HTMLInputElement;

    await user.type(input, '1500000');
    expect(input.value).toBe(`1${NBSP}500${NBSP}000`);
    expect(screen.getByTestId('tiyin').textContent).toBe('150000000');
  });

  it('keeps a typed comma and at most two tiyin digits', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Summa') as HTMLInputElement;

    await user.type(input, '1500,');
    expect(input.value).toBe(`1${NBSP}500,`);
    await user.type(input, '505');
    expect(input.value).toBe(`1${NBSP}500,50`);
    expect(screen.getByTestId('tiyin').textContent).toBe('150050');
  });

  it('fills the amount from a chip', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Hammasi · 900 000' }));
    expect((screen.getByLabelText('Summa') as HTMLInputElement).value).toBe(`900${NBSP}000`);
    expect(screen.getByTestId('tiyin').textContent).toBe('90000000');
  });
});

describe('RangePicker', () => {
  it('orders the two clicks, blocks days after max and applies the range', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<RangePicker value={null} max="2026-10-15" onApply={onApply} onCancel={() => undefined} />);

    expect(screen.getByText('oktabr 2026')).toBeTruthy();
    expect((screen.getByRole('button', { name: '20-oktabr, 2026' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Keyingi oy' }) as HTMLButtonElement).disabled).toBe(true);

    const apply = screen.getByRole('button', { name: 'Qo‘llash' }) as HTMLButtonElement;
    await user.click(screen.getByRole('button', { name: '12-oktabr, 2026' }));
    expect(apply.disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: '3-oktabr, 2026' }));
    await user.click(apply);

    expect(onApply).toHaveBeenCalledWith({ from: '2026-10-03', to: '2026-10-12' });
  });
});

describe('Modal', () => {
  it('keeps Tab inside the dialog and returns focus to the opener', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>ochish</button>
          <Modal isOpen={open} onClose={() => setOpen(false)} title="Yangi hisob" footer={<button>Saqlash</button>}>
            <input aria-label="Nomi" />
          </Modal>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByText('ochish');
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Yangi hisob' });
    const save = within(dialog).getByRole('button', { name: 'Saqlash' });
    save.focus();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe('Segmented', () => {
  it('moves the selection with the arrow keys', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<'oy' | 'hafta' | 'yil'>('oy');
      return (
        <Segmented
          aria-label="Davr"
          value={value}
          onChange={setValue}
          options={[
            { value: 'hafta', label: 'Shu hafta' },
            { value: 'oy', label: 'Shu oy' },
            { value: 'yil', label: 'Shu yil' },
          ]}
        />
      );
    }
    render(<Harness />);
    screen.getByRole('radio', { name: 'Shu oy' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Shu yil' }).getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Shu yil' }));
  });
});

describe('Pagination window', () => {
  it('shows first, last and the neighbours of the current page', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(6, 13)).toEqual([1, 'gap', 5, 6, 7, 'gap', 13]);
    expect(pageWindow(13, 13)).toEqual([1, 'gap', 12, 13]);
  });
});

describe('undo toast', () => {
  it('runs the undo action once and disappears', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUndo = vi.fn();
    render(<ToastContainer />);

    act(() => {
      toast.undo('Tranzaksiya o‘chirildi', onUndo);
    });
    await user.click(screen.getByRole('button', { name: 'Qaytarish' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Tranzaksiya o‘chirildi')).toBeNull();

    act(() => {
      toast.undo('Yana', () => undefined);
      vi.advanceTimersByTime(6100);
    });
    expect(screen.queryByText('Yana')).toBeNull();
    expect(useToastStore.getState().toasts).toHaveLength(0);
    vi.useRealTimers();
  });
});
