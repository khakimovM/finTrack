import type { Dict } from '../uz';
import { ruForms } from '../counted';

export const notifications: Dict['notifications'] = {
  title: 'Уведомления',
  titleWithNew: ruForms('Уведомления, {count} новое', 'Уведомления, {count} новых', 'Уведомления, {count} новых'),
  newCount: ruForms('{count} новое', '{count} новых', '{count} новых'),
  unreadCount: ruForms('{count} непрочитанное', '{count} непрочитанных', '{count} непрочитанных'),
  allRead: 'Всё прочитано',
  all: 'Все',
  unread: 'Непрочитанные',
  markAllRead: 'Отметить все как прочитанные',
  seeAll: 'Показать все',
  loadFailed: 'Не удалось загрузить уведомления',
  empty: 'Новых уведомлений пока нет',
  emptyText: 'Здесь появятся сообщения о бюджетах, сроках долгов и регулярных платежах.',
  open: {
    budget: 'Открыть бюджет',
    debt: 'Открыть долг',
    account: 'Открыть счёт',
    rule: 'Открыть правило',
  },
};
