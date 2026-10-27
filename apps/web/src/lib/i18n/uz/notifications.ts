import { counted } from '../counted';

export const notifications = {
  title: 'Bildirishnomalar',
  titleWithNew: counted('Bildirishnomalar, {count} ta yangi'),
  newCount: counted('{count} ta yangi'),
  unreadCount: counted('{count} ta o‘qilmagan'),
  allRead: 'Hammasi o‘qilgan',
  all: 'Hammasi',
  unread: 'O‘qilmagan',
  markAllRead: 'Barchasini o‘qilgan qilish',
  seeAll: 'Barchasini ko‘rish',
  loadFailed: 'Bildirishnomalarni yuklab bo‘lmadi',
  empty: 'Hozircha yangi bildirishnomalar yo‘q',
  emptyText: 'Byudjet, qarz muddati yoki takroriy to‘lov bo‘yicha xabarlar shu yerda chiqadi.',
  open: {
    budget: 'Byudjetni ochish',
    debt: 'Qarzni ochish',
    account: 'Hisobni ochish',
    rule: 'Qoidani ochish',
  },
};
