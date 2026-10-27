import { useLocaleStore } from '../stores/localeStore';

/** Switches the app to Russian for one test; the shared setup puts Uzbek back afterwards. */
export function inRussian(): void {
  useLocaleStore.setState({ locale: 'ru' });
}

/** Names that are Latin in every language. */
const ALWAYS_LATIN = ['FinTrack', 'Telegram', 'Start', 'UTC', 'UZS', 'IP', 'Chrome', 'Safari', 'Windows', 'iOS', 'CSV', 'Excel', 'PDF'];

/**
 * Latin words on a Russian screen, apart from the data the test served. Uzbek is written in Latin
 * and Russian in Cyrillic, so any other Latin word is a string that missed translation.
 */
export function latinLeftovers(data: string[] = [], root: HTMLElement = document.body): string[] {
  const texts = [root.textContent ?? ''];
  root.querySelectorAll('[aria-label], [title], [placeholder]').forEach((el) => {
    for (const attr of ['aria-label', 'title', 'placeholder']) {
      const value = el.getAttribute(attr);
      if (value) texts.push(value);
    }
  });
  // Longest first, so "Humo karta" goes before a shorter name inside it.
  const allowed = [...data, ...ALWAYS_LATIN].sort((a, b) => b.length - a.length);
  let text = texts.join('\n');
  for (const name of allowed) text = text.split(name).join(' ');
  return [...new Set(text.match(/[A-Za-z][A-Za-z‘’ʼ'-]*/g) ?? [])];
}
