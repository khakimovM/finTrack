import type { Dict } from '../uz';

export const budgets: Dict['budgets'] = {
  state: {
    success: 'В норме',
    warning: 'Больше 80%',
    danger: 'Превышен',
  },
  page: {
    subtitle: 'Месячные лимиты по категориям',
    new: 'Задать бюджет',
    loadFailed: 'Не удалось загрузить бюджеты',
    emptyTitle: '{month}: бюджетов нет',
    emptyText: 'Задайте месячный лимит для категории — предупредим на 80% и 100%.',
    totals: 'Итого за месяц',
    totalLimit: 'Общий лимит',
    spent: 'Потрачено',
    left: 'Остаток',
    spentPercent: 'Потрачено {percent}% лимита',
  },
  card: {
    limit: 'Лимит: {amount}',
    spent: 'Потрачено',
    left: 'Остаток: {amount}',
    over: 'Перерасход лимита на {amount}',
    withChildren: 'Подкатегории тоже учитываются',
    spentPercent: 'Потрачено {percent}%',
  },
  confirm: {
    delete: 'Удалить бюджет «{name}»?',
    deleteText: 'Лимит за «{month}» будет снят. Операции не изменятся.',
  },
  form: {
    titleNew: 'Задать бюджет',
    titleEdit: 'Изменить бюджет',
    description: 'Месячный лимит расходов · {month}',
    category: 'Категория расходов',
    month: 'Месяц',
    fixedHint: 'Чтобы сменить категорию, удалите бюджет и задайте новый.',
    hasBudget: 'Бюджет есть',
    taken: 'На этот месяц для этой категории бюджет уже есть',
    limit: 'Месячный лимит',
    limitError: 'Лимит должен быть больше 0',
  },
  toast: {
    added: 'Бюджет задан',
    saved: 'Бюджет сохранён',
    deleted: 'Бюджет удалён',
  },
};
