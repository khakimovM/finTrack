---
name: chart-widget
description: Build the FinTrack dashboard charts with Recharts — period filtering, zero-filled buckets, category colours, tooltips with formatted money, and responsive behaviour. Use for any chart, diagram, or KPI visualisation.
---

# FinTrack charts

## Data comes ready from the API
The backend aggregates with SQL and returns chart-shaped arrays. The component never
reduces raw transactions. If the shape is wrong, fix the endpoint — not the component.

| Chart | Endpoint |
|---|---|
| Income vs expense over time (line/area) | `GET /api/v1/stats/timeseries?groupBy=day\|week\|month\|year` |
| Expense share by category (donut) | `GET /api/v1/stats/by-category?type=EXPENSE` |
| Category comparison (bar) | same endpoint, different view |
| Balance trend (area) | `GET /api/v1/stats/balance-trend` |
| Budget usage (progress bars) | `GET /api/v1/budgets?month=YYYY-MM` |

## Non-obvious requirements
- **Zero-fill.** SQL omits days with no rows; the API fills them with `0`. Verify this or
  the line chart will show misleading gaps.
- **Money in tooltips** goes through `formatMoney`. Raw tiyin in a tooltip is a bug.
- **Category colours** come from `category.color` in the payload, so the pie slice and the
  legend badge match the category list elsewhere.
- **Empty period** renders `EmptyState`, not an axis with no line.
- **Long labels** rotate or truncate with a tooltip; they never overlap.

## Skeleton
```tsx
<ResponsiveContainer width="100%" height={320}>
  <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
    <XAxis dataKey="bucket" tickFormatter={formatBucket} />
    <YAxis tickFormatter={(v) => compactMoney(BigInt(v))} width={72} />
    <Tooltip content={<MoneyTooltip />} />
    <Legend />
    <Line type="monotone" dataKey="income"  stroke="var(--color-success)" strokeWidth={2} dot={false} />
    <Line type="monotone" dataKey="expense" stroke="var(--color-danger)"  strokeWidth={2} dot={false} />
  </LineChart>
</ResponsiveContainer>
```

## Period filter
A single `usePeriod()` store (Zustand) holds `{ preset, from, to, groupBy }` and feeds every
stats query key, so all charts move together. Presets: `Bugun`, `Shu hafta`, `Shu oy`,
`Shu yil`, `Oraliq`. Changing the preset recomputes `from`/`to` with `date-fns` and picks a
sensible `groupBy` (a year of daily points is unreadable — use months).

## Performance
- `ResponsiveContainer` everywhere; never a fixed pixel width.
- Memoise transformed data with `useMemo` keyed on the query data reference.
- Above ~400 points, switch to `groupBy=week` rather than rendering them all.
