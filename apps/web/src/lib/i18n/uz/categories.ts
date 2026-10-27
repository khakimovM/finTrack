import { counted } from '../counted';

export const categories = {
  page: {
    subtitle: 'Chiqim va kirim kategoriyalari, teglar',
    new: 'Yangi kategoriya',
    sections: 'Bo‘limlar',
    expense: 'Chiqimlar',
    income: 'Kirimlar',
    tags: 'Teglar',
    dragHint: 'Tartibni sudrab o‘zgartiring',
    loadFailed: 'Kategoriyalarni yuklab bo‘lmadi',
    emptyTitle: 'Kategoriyalar mavjud emas',
    emptyText: 'Chiqim va kirimlarni tartiblash uchun birinchi kategoriyani qo‘shing.',
  },
  tree: {
    children: counted('{count} ta subkategoriya'),
    addChild: 'Subkategoriya qo‘shish',
    addChildTitle: '+ Subkategoriya',
    child: 'Subkategoriya',
  },
  confirm: {
    delete: '“{name}” kategoriyasi o‘chirilsinmi?',
    deleteChildren: 'Uning subkategoriyalari ham o‘chiriladi. ',
    deleteText: 'Tranzaksiyalar saqlanadi, lekin kategoriyasiz qoladi. Unga qo‘yilgan byudjetlar o‘chiriladi.',
  },
  form: {
    titleNew: 'Yangi kategoriya',
    titleNewChild: 'Yangi subkategoriya',
    titleEdit: 'Kategoriyani tahrirlash',
    type: 'Kategoriya turi',
    typeLocked: 'Tahrirlashda turini o‘zgartirib bo‘lmaydi',
    expense: 'Chiqim kategoriyasi',
    income: 'Kirim kategoriyasi',
    name: 'Kategoriya nomi',
    namePlaceholder: 'Masalan: Bozorlik',
    nameRequired: 'Kategoriya nomini kiriting',
    nameTaken: 'Bunday nomli kategoriya allaqachon mavjud',
    tooDeep: 'Kategoriyalar faqat ikki darajali bo‘lishi mumkin',
    parent: 'Ota kategoriya (ixtiyoriy)',
    noParent: '— Asosiy —',
    hasChildren: 'Subkategoriyasi bor kategoriyani boshqasiga ko‘chirib bo‘lmaydi',
  },
  toast: {
    added: 'Kategoriya qo‘shildi',
    deleted: 'Kategoriya o‘chirildi',
  },
};

export const tags = {
  new: 'Yangi teg',
  loadFailed: 'Teglarni yuklab bo‘lmadi',
  emptyTitle: 'Teglar yo‘q',
  emptyText: 'Tranzaksiyalarni guruhlash uchun teg yarating',
  name: 'Teg nomi',
  namePlaceholder: 'teg nomi',
  nameRequired: 'Teg nomini kiriting',
  nameTaken: 'Bunday teg allaqachon mavjud',
  count: counted('{count} ta tranzaksiya'),
  confirmDelete: '“{name}” tegi o‘chirilsinmi?',
  confirmDeleteText: 'Teg tranzaksiyalardan olib tashlanadi, tranzaksiyalarning o‘zi qoladi.',
  saved: 'Teg saqlandi',
  deleted: 'Teg o‘chirildi',
};
