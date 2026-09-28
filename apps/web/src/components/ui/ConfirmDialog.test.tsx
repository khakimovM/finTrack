import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConfirm } from './ConfirmDialog';
import { Modal } from './Modal';

function Harness() {
  const [dialog, confirm] = useConfirm();
  const [answer, setAnswer] = useState('none');
  return (
    <>
      <button
        onClick={async () =>
          setAnswer(
            String(
              await confirm({
                title: 'O‘chirilsinmi?',
                confirmLabel: 'O‘chirish',
                destructive: true,
              }),
            ),
          )
        }
      >
        open
      </button>
      <span data-testid="answer">{answer}</span>
      {dialog}
    </>
  );
}

describe('useConfirm', () => {
  it('resolves true on confirm and false on cancel or Escape, and closes each time', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('open'));
    await user.click(screen.getByRole('button', { name: 'O‘chirish' }));
    expect(screen.getByTestId('answer').textContent).toBe('true');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByText('open'));
    await user.click(screen.getByRole('button', { name: 'Bekor qilish' }));
    expect(screen.getByTestId('answer').textContent).toBe('false');

    await user.click(screen.getByText('open'));
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('answer').textContent).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('focuses the confirm button and gives focus back to the opener', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByText('open');

    await user.click(opener);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'O‘chirish' }));
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(opener);
  });
});

describe('Modal', () => {
  function Form() {
    const [value, setValue] = useState('');
    return (
      <Modal isOpen onClose={() => undefined} title="Forma">
        <input aria-label="Izoh" value={value} onChange={(e) => setValue(e.target.value)} />
      </Modal>
    );
  }

  it('keeps focus in a field while the user types (inline onClose re-renders)', async () => {
    const user = userEvent.setup();
    render(<Form />);
    const input = screen.getByLabelText('Izoh');

    await user.click(input);
    await user.keyboard('taksi');

    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).value).toBe('taksi');
  });
});
