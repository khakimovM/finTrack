---
description: Build a new frontend page or screen to spec.
---

# /new-page

1. Read the page's section in `docs/05-FRONTEND-SPEC.md`. If it is not specified, write the
   spec first and confirm it.
2. Confirm the endpoints it needs exist and are documented. If not, stop — build the API first.
3. Create:
   - `src/pages/<Name>Page.tsx` (layout and composition only)
   - `src/features/<feature>/` components, hooks, api client
   - a route entry in `src/routes/index.tsx` under the protected layout
4. Implement all four view states: loading skeleton, error with retry, empty with a CTA, success.
5. Wire forms with react-hook-form + `zodResolver` using the shared schemas.
6. Check at 375px, 768px, and 1440px. Tables become cards on mobile.
7. Check dark mode and keyboard navigation.
8. Add a Vitest component test for the states and a Playwright step if the page is on the
   critical path.
9. `pnpm verify`.

Do not invent UI text in English — user-facing strings are Uzbek.
