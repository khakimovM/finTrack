/**
 * Accounts, categories and tags store a hex colour. The design draws them with the theme-aware
 * chart-1…9 tokens, so a stored colour is mapped to its token: the chart palette's own light
 * values map exactly, the old pickers' palette maps to the nearest hue, anything else stays as is.
 */

/** chart-1…9 light values, in token order. New pickers store these. */
export const CHART_COLORS = [
  '#2f9e68',
  '#3d7bd6',
  '#e0a11b',
  '#8a63d2',
  '#22a3a3',
  '#e06a4e',
  '#cf5c9c',
  '#8fa531',
  '#7d8796',
] as const;

export const CHART_COLOR_NAMES = ['Yashil', 'Ko‘k', 'Sariq', 'Binafsha', 'Moviy', 'Marjon', 'Pushti', 'Zaytun', 'Kulrang'] as const;

const LEGACY_TO_CHART: Record<string, number> = {
  '#22c55e': 1,
  '#10b981': 1,
  '#3b82f6': 2,
  '#f59e0b': 3,
  '#eab308': 3,
  '#f97316': 3,
  '#6366f1': 4,
  '#8b5cf6': 4,
  '#14b8a6': 5,
  '#06b6d4': 5,
  '#ef4444': 6,
  '#ec4899': 7,
  '#84cc16': 8,
  '#94a3b8': 9,
};

/** 1-based chart index for a stored colour, or null when it is not one of ours. */
export function chartIndexOf(hex: string | null | undefined): number | null {
  if (!hex) return null;
  const key = hex.trim().toLowerCase();
  const own = CHART_COLORS.indexOf(key as (typeof CHART_COLORS)[number]);
  if (own >= 0) return own + 1;
  return LEGACY_TO_CHART[key] ?? null;
}

/** CSS colour to paint with: a chart token when we know it, the stored hex otherwise. */
export function colorVar(hex: string | null | undefined, fallbackIndex = 9): string {
  const index = chartIndexOf(hex);
  if (index) return `var(--chart-${index})`;
  return hex && /^#[0-9a-f]{3,8}$/i.test(hex) ? hex : `var(--chart-${fallbackIndex})`;
}

/** The 16% tint the design puts behind emoji tiles (amber needs 18% to read). */
export function tintOf(hex: string | null | undefined, fallbackIndex = 9): string {
  const index = chartIndexOf(hex) ?? fallbackIndex;
  const amount = index === 3 ? 18 : 16;
  return `color-mix(in oklab, ${colorVar(hex, fallbackIndex)} ${amount}%, transparent)`;
}

/** Stable colour for a value without one (e.g. legend rows), cycling the palette. */
export function chartColorAt(position: number): string {
  return `var(--chart-${(position % 9) + 1})`;
}
