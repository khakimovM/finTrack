import { CategoryResponse } from '@fintrack/shared';

export interface CategoryOption {
  id: string;
  name: string;
}

/** Categories of one type as a flat, indented list: each parent followed by its children. */
export function categoryOptions(
  categories: CategoryResponse[],
  type: 'INCOME' | 'EXPENSE',
): CategoryOption[] {
  return categories
    .filter((c) => c.type === type)
    .flatMap((parent) => [
      { id: parent.id, name: `${parent.icon} ${parent.name}` },
      ...(parent.children ?? []).map((child) => ({
        id: child.id,
        name: `  ↳ ${child.icon} ${child.name}`,
      })),
    ]);
}
