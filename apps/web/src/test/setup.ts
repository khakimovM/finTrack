import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { server } from './server';
import { testViewport } from './viewport';

// `npm run verify` runs the API suite at the same time; a cold first render can take longer than
// findBy's default second there. Five seconds waits for slow, not for wrong.
configure({ asyncUtilTimeout: 5_000 });

// Any request a test did not mock is a bug in the test, not a call to a real server.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  testViewport.width = 1280;
  testViewport.reducedMotion = true;
});
afterAll(() => server.close());

// jsdom lacks matchMedia, which the theme store reads at import time and layouts read to pick
// desktop or phone UI. Width queries answer for a desktop viewport unless a test changes it;
// reduced motion answers yes unless a test turns it off.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: evaluateQuery(query),
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

function evaluateQuery(query: string): boolean {
  if (query.includes('prefers-reduced-motion')) return testViewport.reducedMotion;
  const width = testViewport.width;
  const min = /min-width:\s*(\d+)px/.exec(query);
  const max = /max-width:\s*(\d+)px/.exec(query);
  if (!min && !max) return false;
  return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
}
