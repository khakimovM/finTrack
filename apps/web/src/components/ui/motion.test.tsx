import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Collapse } from './Collapse';
import { useConfirm } from './ConfirmDialog';
import { Modal } from './Modal';
import { Segmented } from './Segmented';
import { ToastContainer } from './Toast';
import { toast, useToastStore } from '../../stores/toastStore';
import { EXIT_MS } from '../../lib/motion';
import { setReducedMotion } from '../../test/viewport';

describe('exit animations', () => {
  beforeEach(() => {
    setReducedMotion(false);
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function ModalHarness() {
    const [tx, setTx] = useState<string | null>('Taksi');
    return (
      <>
        <button onClick={() => setTx('Korzinka')}>ochish</button>
        <Modal isOpen={tx !== null} onClose={() => setTx(null)} title={tx ?? ''}>
          <p>{tx ?? 'bo‘sh'}</p>
        </Modal>
      </>
    );
  }

  it('keeps the modal and its last content on screen while it animates out', () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }));

    // The parent has already cleared its data; the closing dialog still shows what it had.
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.textContent).toContain('Taksi');
    expect(dialog.textContent).not.toContain('bo‘sh');
    // Out of the accessibility tree and the click path while it fades.
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => vi.advanceTimersByTime(EXIT_MS.slow));
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });

  it('reopening during the exit keeps the modal instead of dropping it', () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }));
    fireEvent.click(screen.getByText('ochish'));

    act(() => vi.advanceTimersByTime(EXIT_MS.slow));
    expect(screen.getByRole('dialog', { name: 'Korzinka' })).toBeTruthy();
  });

  it('closes at once with reduced motion', () => {
    setReducedMotion(true);
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }));
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });

  it('answers a confirm at once and ignores clicks while it fades', async () => {
    const onAnswer = vi.fn();
    function Harness() {
      const [dialog, confirm] = useConfirm();
      return (
        <>
          <button onClick={() => void confirm({ title: 'O‘chirilsinmi?' }).then(onAnswer)}>so‘ra</button>
          {dialog}
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByText('so‘ra'));
    fireEvent.click(screen.getByRole('button', { name: 'Tasdiqlash' }));
    await act(async () => undefined);
    expect(onAnswer).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish', hidden: true }));
    act(() => vi.advanceTimersByTime(EXIT_MS.slow));
    await act(async () => undefined);
    expect(screen.queryByRole('alertdialog', { hidden: true })).toBeNull();
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('lets a dismissed toast slide out before it leaves the list', () => {
    render(<ToastContainer />);
    act(() => {
      toast.success('Saqlandi');
    });
    const [item] = useToastStore.getState().toasts;

    act(() => useToastStore.getState().removeToast(item.id));
    expect(useToastStore.getState().toasts[0]?.leaving).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();

    act(() => vi.advanceTimersByTime(EXIT_MS.base));
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('keeps a closed accordion panel hidden in the DOM and lets it collapse first', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen((v) => !v)}>savol</button>
          <Collapse open={open} keepMounted id="javob">
            <p>Javob</p>
          </Collapse>
        </>
      );
    }
    const { container } = render(<Harness />);
    const panel = () => container.querySelector<HTMLElement>('#javob');
    expect(panel()?.hidden).toBe(true);

    fireEvent.click(screen.getByText('savol'));
    expect(panel()?.hidden).toBe(false);

    fireEvent.click(screen.getByText('savol'));
    expect(panel()?.hidden).toBe(false);
    act(() => vi.advanceTimersByTime(EXIT_MS.slow));
    expect(panel()?.hidden).toBe(true);
  });
});

describe('Segmented thumb', () => {
  it('slides one card between the segments once it can measure them', () => {
    // jsdom has no layout: each segment is 80×36, laid out every 84px.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(36);
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(4);
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
      const buttons = Array.from(this.parentElement?.querySelectorAll('button') ?? []);
      return 4 + buttons.indexOf(this as HTMLButtonElement) * 84;
    });

    function Harness() {
      const [value, setValue] = useState<'hafta' | 'oy' | 'yil'>('oy');
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
    const { container } = render(<Harness />);
    const thumb = () => container.querySelector<HTMLElement>('[role="radiogroup"] > span[aria-hidden]');

    expect(thumb()?.style.transform).toBe('translate(88px, 4px)');
    expect(thumb()?.style.width).toBe('80px');
    // The card is drawn once, by the thumb, not again by the active button.
    expect(screen.getByRole('radio', { name: 'Shu oy' }).className).not.toContain('bg-card');

    fireEvent.click(screen.getByRole('radio', { name: 'Shu yil' }));
    expect(thumb()?.style.transform).toBe('translate(172px, 4px)');
  });

  it('falls back to the active segment drawing its own card without layout', () => {
    render(
      <Segmented
        aria-label="Tur"
        value="EXPENSE"
        onChange={() => undefined}
        options={[
          { value: 'EXPENSE', label: 'Chiqim' },
          { value: 'INCOME', label: 'Kirim' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Chiqim' }).className).toContain('bg-card');
  });
});
