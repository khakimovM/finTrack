---
name: ui-component
description: Build FinTrack UI components with Tailwind and shadcn/ui — the four required view states, money and date display, mobile behaviour, and accessibility. Use when creating or changing any React component that renders data or forms.
---

# FinTrack UI components

## The four states — mandatory
Any component that renders server data must handle all four. A view missing one is not done.

```tsx
if (isPending) return <TransactionTableSkeleton rows={8} />;
if (isError)   return <ErrorState onRetry={refetch} message={apiErrorToMessage(error)} />;
if (!data.length) return (
  <EmptyState
    icon={<Wallet />}
    title="Hali tranzaksiya yo'q"
    description="Birinchi kirim yoki chiqimingizni qo'shing"
    action={<Button onClick={openCreate}>+ Qo'shish</Button>}
  />
);
return <TransactionTable rows={data} />;
```
Skeletons mirror the real layout — never a bare centred spinner for a table or a chart.

## Shared primitives
Live in `src/components/ui/` (shadcn/ui based): `Button`, `Input`, `MoneyInput`, `Select`,
`DatePicker`, `DateRangePicker`, `Modal`, `Sheet`, `Card`, `Badge`, `Tabs`, `Table`,
`Pagination`, `Skeleton`, `EmptyState`, `ErrorState`, `ConfirmDialog`, `Toast`.

Reuse them. Do not hand-roll a second button.

## MoneyInput
- Accepts som, shows grouped digits while typing, emits tiyin as a string.
- Never stores a formatted value in form state.
- Right-aligned, `inputMode="decimal"`, currency suffix in a muted span.

## Money display
```tsx
<Amount value={row.amount} type={row.type} />
```
- income → `+` and `text-success`
- expense → `−` and `text-danger`
- negative balance → minus sign + `text-danger` + `<AlertTriangle />`; never colour alone
- format via `formatMoney` from `packages/shared`

## Forms
react-hook-form + `zodResolver`, schema imported from `packages/shared`.
Submit button is disabled and shows a spinner while `isPending`. Server field errors from
`error.details[]` are mapped back onto the matching input via `setError`.

## Mobile (375px is the baseline)
- Tables collapse to stacked cards below `md`.
- Sidebar becomes a `Sheet` behind a burger button.
- Charts get a horizontal scroll container rather than shrinking labels below 10px.
- Tap targets ≥ 44px.

## Accessibility
- Keyboard reachable, visible focus ring (`focus-visible:ring-2`).
- `aria-label` on icon-only buttons; `aria-live="polite"` on the balance figure.
- Modals trap focus and close on Escape.
- Never convey state with colour alone.

## Styling rules
- Tailwind tokens only (`bg-surface`, `text-muted`, `text-danger`), no raw hex outside
  `tailwind.config.ts` and chart colour props.
- Variants via `cva`, merged with `cn()`.
- Dark mode with `dark:` on every surface and text colour you add.
