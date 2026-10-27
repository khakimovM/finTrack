import type { Dict } from '../uz';
import { ruForms } from '../counted';

export const categories: Dict['categories'] = {
  page: {
    subtitle: 'Категории расходов и доходов, теги',
    new: 'Новая категория',
    sections: 'Разделы',
    expense: 'Расходы',
    income: 'Доходы',
    tags: 'Теги',
    dragHint: 'Меняйте порядок перетаскиванием',
    loadFailed: 'Не удалось загрузить категории',
    emptyTitle: 'Категорий пока нет',
    emptyText: 'Добавьте первую категорию, чтобы упорядочить расходы и доходы.',
  },
  tree: {
    children: ruForms('{count} подкатегория', '{count} подкатегории', '{count} подкатегорий'),
    addChild: 'Добавить подкатегорию',
    addChildTitle: '+ Подкатегория',
    child: 'Подкатегория',
  },
  confirm: {
    delete: 'Удалить категорию «{name}»?',
    deleteChildren: 'Её подкатегории тоже будут удалены. ',
    deleteText: 'Операции сохранятся, но останутся без категории. Бюджеты этой категории будут удалены.',
  },
  form: {
    titleNew: 'Новая категория',
    titleNewChild: 'Новая подкатегория',
    titleEdit: 'Изменить категорию',
    type: 'Тип категории',
    typeLocked: 'При изменении тип сменить нельзя',
    expense: 'Категория расходов',
    income: 'Категория доходов',
    name: 'Название категории',
    namePlaceholder: 'Например: Продукты',
    nameRequired: 'Введите название категории',
    nameTaken: 'Категория с таким названием уже есть',
    tooDeep: 'Категории могут быть только двухуровневыми',
    parent: 'Родительская категория (необязательно)',
    noParent: '— Основная —',
    hasChildren: 'Категорию с подкатегориями нельзя перенести в другую',
  },
  toast: {
    added: 'Категория добавлена',
    deleted: 'Категория удалена',
  },
};

export const tags: Dict['tags'] = {
  new: 'Новый тег',
  loadFailed: 'Не удалось загрузить теги',
  emptyTitle: 'Тегов нет',
  emptyText: 'Создайте тег, чтобы группировать операции',
  name: 'Название тега',
  namePlaceholder: 'название тега',
  nameRequired: 'Введите название тега',
  nameTaken: 'Такой тег уже есть',
  count: ruForms('{count} операция', '{count} операции', '{count} операций'),
  confirmDelete: 'Удалить тег «{name}»?',
  confirmDeleteText: 'Тег будет снят с операций, сами операции останутся.',
  saved: 'Тег сохранён',
  deleted: 'Тег удалён',
};
