# Frontend rules — React

## The state boundary (most common source of bugs)
- **Anything that comes from the server → TanStack Query.** Transactions, categories,
  accounts, budgets, debts, stats, notifications.
- **Anything that only exists in the browser → Zustand.** Auth user object, theme,
  sidebar open/closed, active period filter, locale.
- Never copy server data into a Zustand store. Never call `useEffect` + `setState` to
  mirror a query result.

## TanStack Query conventions
- All query keys come from `src/lib/queryKeys.ts`. No inline array literals.
- Every list query carries its filters in the key: `['transactions', filters]`.
- Mutations declare their invalidations explicitly; see the table in
  `docs/05-FRONTEND-SPEC.md`.
- Use `placeholderData: keepPreviousData` for paginated lists so the table does not collapse.
- Optimistic updates only where the spec asks for them, always with an `onError` rollback.

## Components
- Presentational components live in `src/components/`, feature-bound ones in
  `src/features/<feature>/`. A component in `components/` may not import from `features/`.
- Data fetching happens in a hook (`src/features/<feature>/hooks/`), never inline in JSX.
- Every data-driven view renders four states: **loading (skeleton), error (with retry),
  empty (with a call to action), success**. A view missing one of these is incomplete.
- Forms: react-hook-form + `zodResolver`, schema imported from `packages/shared`.
- No `<form>` submit that reloads; no uncontrolled inputs for money fields.

## Money and dates in the UI
- The API sends money as a **string of tiyin**. Convert only in `formatMoney()`.
  Never do arithmetic on the formatted string.
- Input fields collect UZS; convert with `somToTiyin()` before sending.
- Display format: `1 250 000,00 so'm` (non-breaking space as thousands separator).
- Dates: `date-fns` with the `uz` locale. Never `new Date(string)` on a bare `YYYY-MM-DD`
  without `parseISO`.

## Styling
- Tailwind utility classes; shared variants via `cva`. No inline `style` objects except for
  dynamic chart colours.
- Use design tokens from `tailwind.config.ts` (`bg-surface`, `text-muted`,
  `text-danger`), not raw hex values.
- Dark mode via the `dark:` variant, driven by a class on `<html>`.
- Mobile first. Every page must work at 375px: tables become cards, sidebar becomes a sheet.

## Accessibility
- Every interactive element is reachable by keyboard and has a visible focus ring.
- Icon-only buttons need `aria-label`.
- Colour is never the only signal: a negative balance shows a minus sign and an icon,
  not just red text.
