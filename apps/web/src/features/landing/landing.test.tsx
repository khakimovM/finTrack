import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HeroVisual } from './HeroVisual';
import { Faq, Features } from './Sections';
import { NBSP } from '../../lib/money';
import { setReducedMotion } from '../../test/viewport';

const BALANCE = `43${NBSP}050${NBSP}000`;

/** An IntersectionObserver the test scrolls by hand. */
class StubObserver {
  static all: StubObserver[] = [];
  constructor(private readonly callback: IntersectionObserverCallback) {
    StubObserver.all.push(this);
  }
  observe() {}
  disconnect() {}
  scrollIntoView() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  StubObserver.all = [];
});

describe('hero scene', () => {
  it('shows the finished scene at once with reduced motion', () => {
    const { container } = render(<HeroVisual />);
    expect(container.textContent).toContain(BALANCE);
    expect(container.querySelector('.animate-ft-blip')).toBeNull();
    expect(container.querySelector('[class*="animate-"]')).toBeNull();
  });

  it('counts the figures up and lands on the exact numbers', () => {
    setReducedMotion(false);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const { container } = render(<HeroVisual />);
    // The bot "types" before its draft arrives.
    expect(container.querySelector('.animate-ft-blip')).not.toBeNull();
    expect(container.textContent).not.toContain(BALANCE);

    act(() => vi.advanceTimersByTime(1150));
    const midway = container.textContent ?? '';
    expect(midway).not.toContain(BALANCE);

    act(() => vi.advanceTimersByTime(2000));
    expect(container.textContent).toContain(BALANCE);
    expect(container.textContent).toContain(`+9${NBSP}700${NBSP}000`);
  });
});

describe('sections on scroll', () => {
  it('keeps feature cards hidden until they scroll into view, then lets them rise in turn', () => {
    setReducedMotion(false);
    vi.stubGlobal('IntersectionObserver', StubObserver);
    render(
      <MemoryRouter>
        <Features />
      </MemoryRouter>,
    );
    const cards = screen.getAllByRole('article');
    expect(cards.every((card) => card.className.includes('opacity-0'))).toBe(true);

    act(() => StubObserver.all.forEach((observer) => observer.scrollIntoView()));
    expect(cards.every((card) => card.className.includes('animate-ft-rise'))).toBe(true);
    expect(cards.map((card) => card.style.animationDelay)).toEqual(['', '90ms', '180ms', '', '90ms', '180ms']);
  });

  it('never hides anything from someone who asked for reduced motion', () => {
    vi.stubGlobal('IntersectionObserver', StubObserver);
    const { container } = render(
      <MemoryRouter>
        <Features />
      </MemoryRouter>,
    );
    expect(container.querySelector('.opacity-0')).toBeNull();
  });
});

describe('FAQ', () => {
  it('opens one answer at a time and hides the closed ones', () => {
    render(<Faq />);
    const first = screen.getByRole('button', { name: 'Telegram’siz foydalansa bo‘ladimi?' });
    const second = screen.getByRole('button', { name: 'Ovozli xabarni qanday yuboraman?' });
    const answer = (button: HTMLElement) => document.getElementById(button.getAttribute('aria-controls') ?? '');

    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(answer(first)?.hidden).toBe(false);
    expect(answer(second)?.hidden).toBe(true);

    fireEvent.click(second);
    expect(answer(second)?.hidden).toBe(false);
    expect(answer(first)?.hidden).toBe(true);
  });
});
