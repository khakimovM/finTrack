import type { Dict } from '../uz';

export const reports: Dict['reports'] = {
  presets: {
    this_month: 'Этот месяц',
    last_month: 'Прошлый месяц',
    this_year: 'Этот год',
    custom: 'Период',
  },
  page: {
    subtitle: 'Сравнение периодов, изменения по категориям и экспорт',
    exported: 'Отчёт скачан',
    loadFailed: 'Не удалось загрузить отчёт',
    empty: 'За эти периоды записей нет',
    emptyText: 'Выберите другой период или продолжайте записывать доходы и расходы.',
    expenseByCategory: 'Расходы по категориям',
    incomeByCategory: 'Доходы по категориям',
    andPrevious: 'и предыдущий период',
  },
  compare: {
    title: 'Сравнение периодов',
    metric: 'Показатель',
    net: 'Чистый итог',
    before: 'Раньше: {value}',
    expenseChart: 'Расходы: текущий и предыдущий период',
    incomeChart: 'Доходы: текущий и предыдущий период',
    day: 'День {n}',
    days: 'Дни {from}–{to}',
  },
  picker: {
    start: 'Начало',
    end: 'Окончание',
    both: 'Выберите обе даты',
    endBeforeStart: 'Дата окончания не может быть раньше даты начала',
  },
};
