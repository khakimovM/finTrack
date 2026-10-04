import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';
import { testViewport } from './viewport';

// Any request a test did not mock is a bug in the test, not a call to a real server.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  testViewport.width = 1280;
});
afterAll(() => server.close());

// jsdom lacks matchMedia, which the theme store reads at import time and layouts read to pick
// desktop or phone UI. Width queries answer for a desktop viewport unless a test changes it.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: evaluateWidthQuery(query),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function evaluateWidthQuery(query: string): boolean {
  const width = testViewport.width;
  const min = /min-width:\s*(\d+)px/.exec(query);
  const max = /max-width:\s*(\d+)px/.exec(query);
  if (!min && !max) return false;
  return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
}
