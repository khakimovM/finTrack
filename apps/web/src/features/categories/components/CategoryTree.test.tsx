import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryTree, changedGroups, regroup } from './CategoryTree';
import { category } from '../../../test/fixtures';
import { moveTo } from '../../../lib/useSortable';

const taxi = category({ name: 'Taksi', parentId: 'transport' });
const metro = category({ name: 'Metro', parentId: 'transport' });
const transport = category({ id: 'transport', name: 'Transport', isSystem: true, children: [taxi, metro] });
const food = category({ name: 'Oziq-ovqat' });
const cafe = category({ name: 'Kafe' });

function setup() {
  const props = { onAddChild: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onReorder: vi.fn() };
  render(<CategoryTree categories={[transport, food, cafe]} compact={false} {...props} />);
  const rowOf = (name: string) => screen.getByText(name).closest('[data-sort-id]') as HTMLElement;
  return { props, rowOf };
}

describe('CategoryTree', () => {
  it('lists children under their parent with a count, and keeps system categories', () => {
    const { rowOf } = setup();
    const names = Array.from(document.querySelectorAll('[data-sort-id]')).map((row) => row.textContent);
    expect(names.map((text) => text?.match(/Transport|Taksi|Metro|Oziq-ovqat|Kafe/)?.[0])).toEqual([
      'Transport',
      'Taksi',
      'Metro',
      'Oziq-ovqat',
      'Kafe',
    ]);
    expect(within(rowOf('Transport')).getByText('2 ta subkategoriya')).toBeTruthy();
    expect(within(rowOf('Transport')).getByText('Standart')).toBeTruthy();
    expect(within(rowOf('Transport')).queryByRole('button', { name: 'O‘chirish' })).toBeNull();
    expect(within(rowOf('Kafe')).getByRole('button', { name: 'O‘chirish' })).toBeTruthy();
  });

  it('adds a subcategory only under a parent', async () => {
    const { props, rowOf } = setup();
    expect(within(rowOf('Taksi')).queryByRole('button', { name: 'Subkategoriya qo‘shish' })).toBeNull();
    await userEvent.click(within(rowOf('Kafe')).getByRole('button', { name: 'Subkategoriya qo‘shish' }));
    expect(props.onAddChild).toHaveBeenCalledWith(cafe);
  });

  it('moves a parent with the keyboard and saves only that group', async () => {
    const { props, rowOf } = setup();
    within(rowOf('Kafe')).getByLabelText('Sudrash').focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(props.onReorder).toHaveBeenCalledWith([
      { id: transport.id, sortOrder: 1 },
      { id: cafe.id, sortOrder: 2 },
      { id: food.id, sortOrder: 3 },
    ]);
  });

  it('moves a child only among its siblings', async () => {
    const { props, rowOf } = setup();
    within(rowOf('Metro')).getByLabelText('Sudrash').focus();
    // Metro is the last child: going further down would leave its parent, so nothing happens.
    await userEvent.keyboard('{ArrowDown}');
    expect(props.onReorder).not.toHaveBeenCalled();
    await userEvent.keyboard('{ArrowUp}');
    expect(props.onReorder).toHaveBeenCalledWith([
      { id: metro.id, sortOrder: 1 },
      { id: taxi.id, sortOrder: 2 },
    ]);
  });
});

describe('regroup and changedGroups', () => {
  const parentOf = new Map<string, string | null>([
    ['a', null],
    ['a1', 'a'],
    ['b', null],
  ]);

  it('keeps children under a parent that moved past another', () => {
    const dragged = moveTo(['a', 'a1', 'b'], 'a', 'b');
    expect(dragged).toEqual(['a1', 'b', 'a']);
    expect(regroup(dragged, parentOf)).toEqual(['b', 'a', 'a1']);
  });

  it('reports nothing when the order is the same', () => {
    expect(changedGroups(['a', 'a1', 'b'], ['a', 'a1', 'b'], parentOf)).toEqual([]);
  });
});
