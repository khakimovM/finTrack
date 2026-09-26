import {
  CategoryStatsItem,
  CategoryStatsChild,
  StatsCompareCategoryItem,
} from '@fintrack/shared';
import { CategoryStatRow, CompareCategoryRow } from './stats.repository';

export function calcPercent(part: bigint, total: bigint): number {
  if (total <= 0n || part <= 0n) return 0;
  return Math.round(Number((part * 10000n) / total)) / 100;
}

export function calcChangePercent(current: bigint, previous: bigint): number {
  if (previous === 0n) {
    return current > 0n ? 100.0 : 0.0;
  }
  return Math.round(Number(((current - previous) * 10000n) / previous)) / 100;
}

export interface CategoryLookup {
  id: string;
  name: string;
  icon: string;
  color: string;
  parentId: string | null;
}

export function groupCategoriesWithRollup(
  rows: CategoryStatRow[],
  allCategories: CategoryLookup[],
): { total: string; items: CategoryStatsItem[] } {
  const catMap = new Map(allCategories.map((c) => [c.id, c]));
  let grandTotal = 0n;
  for (const row of rows) {
    grandTotal += BigInt(row.amount);
  }

  const parentMap = new Map<
    string,
    {
      categoryId: string | null;
      name: string;
      icon: string;
      color: string;
      amount: bigint;
      count: number;
      children: CategoryStatsChild[];
    }
  >();

  let uncategorizedAmount = 0n;
  let uncategorizedCount = 0;

  for (const row of rows) {
    const rowAmount = BigInt(row.amount);
    const rowCount = Number(row.count);

    if (!row.categoryId) {
      uncategorizedAmount += rowAmount;
      uncategorizedCount += rowCount;
      continue;
    }

    const category = catMap.get(row.categoryId);
    const parentId = category?.parentId ?? row.parentId;

    if (parentId) {
      const parent = catMap.get(parentId);
      const pId = parent?.id ?? parentId;
      const pName = parent?.name ?? 'Kategoriya';
      const pIcon = parent?.icon ?? '📁';
      const pColor = parent?.color ?? '#94a3b8';

      if (!parentMap.has(pId)) {
        parentMap.set(pId, {
          categoryId: pId,
          name: pName,
          icon: pIcon,
          color: pColor,
          amount: 0n,
          count: 0,
          children: [],
        });
      }

      const existingParent = parentMap.get(pId)!;
      existingParent.amount += rowAmount;
      existingParent.count += rowCount;
      existingParent.children.push({
        categoryId: row.categoryId,
        name: row.categoryName ?? category?.name ?? 'Nomaʼlum',
        amount: rowAmount.toString(),
        percent: calcPercent(rowAmount, grandTotal),
      });
    } else {
      const pId = row.categoryId;
      if (!parentMap.has(pId)) {
        parentMap.set(pId, {
          categoryId: pId,
          name: row.categoryName ?? category?.name ?? 'Kategoriya',
          icon: row.icon ?? category?.icon ?? '📁',
          color: row.color ?? category?.color ?? '#94a3b8',
          amount: 0n,
          count: 0,
          children: [],
        });
      }
      const existingParent = parentMap.get(pId)!;
      existingParent.amount += rowAmount;
      existingParent.count += rowCount;
    }
  }

  const items: CategoryStatsItem[] = Array.from(parentMap.values()).map((p) => ({
    categoryId: p.categoryId,
    name: p.name,
    icon: p.icon,
    color: p.color,
    amount: p.amount.toString(),
    percent: calcPercent(p.amount, grandTotal),
    count: p.count,
    children: p.children.sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1)),
  }));

  if (uncategorizedAmount > 0n || uncategorizedCount > 0) {
    items.push({
      categoryId: null,
      name: 'Boshqa',
      icon: '📁',
      color: '#94a3b8',
      amount: uncategorizedAmount.toString(),
      percent: calcPercent(uncategorizedAmount, grandTotal),
      count: uncategorizedCount,
      children: [],
    });
  }

  items.sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1));

  return {
    total: grandTotal.toString(),
    items,
  };
}

export function buildCompareByCategory(
  currExpenses: CompareCategoryRow[],
  prevExpenses: CompareCategoryRow[],
): StatsCompareCategoryItem[] {
  const prevMap = new Map(prevExpenses.map((p) => [p.categoryId ?? 'none', p]));
  const seen = new Set<string>();
  const byCategory: StatsCompareCategoryItem[] = [];

  for (const curr of currExpenses) {
    const key = curr.categoryId ?? 'none';
    seen.add(key);
    const prev = prevMap.get(key);
    const currAmt = BigInt(curr.amount);
    const prevAmt = prev ? BigInt(prev.amount) : 0n;
    const change = currAmt - prevAmt;

    byCategory.push({
      categoryId: curr.categoryId,
      name: curr.name ?? 'Boshqa',
      color: curr.color ?? '#94a3b8',
      icon: curr.icon ?? '📁',
      currentAmount: currAmt.toString(),
      previousAmount: prevAmt.toString(),
      change: change.toString(),
      changePercent: calcChangePercent(currAmt, prevAmt),
    });
  }

  for (const prev of prevExpenses) {
    const key = prev.categoryId ?? 'none';
    if (seen.has(key)) continue;
    const prevAmt = BigInt(prev.amount);
    const change = -prevAmt;

    byCategory.push({
      categoryId: prev.categoryId,
      name: prev.name ?? 'Boshqa',
      color: prev.color ?? '#94a3b8',
      icon: prev.icon ?? '📁',
      currentAmount: '0',
      previousAmount: prevAmt.toString(),
      change: change.toString(),
      changePercent: -100.0,
    });
  }

  byCategory.sort((a, b) => (BigInt(b.currentAmount) > BigInt(a.currentAmount) ? 1 : -1));
  return byCategory;
}
