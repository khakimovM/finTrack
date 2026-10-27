import type { Dict } from '../uz';

export const nav: Dict['nav'] = {
  home: 'Главная',
  transactions: 'Операции',
  accounts: 'Счета',
  debts: 'Долги',
  recurring: 'Регулярные платежи',
  budgets: 'Бюджеты',
  reports: 'Отчёты',
  categories: 'Категории и теги',
  notifications: 'Уведомления',
  settings: 'Настройки',
  groupMoney: 'Деньги',
  groupPlan: 'План и анализ',
  groupSetup: 'Настройка',
  mainMenu: 'Главное меню',
  expandMenu: 'Развернуть меню',
  collapseMenu: 'Свернуть меню',
  toggleTheme: 'Сменить тему',
  viaTelegram: 'Через Telegram',
  logout: 'Выйти',
  more: 'Ещё',
  otherSections: 'Другие разделы',
  theme: 'Тема',
  themeLight: 'Светлая',
  themeDark: 'Тёмная',
  themeFollowsTelegram: 'Тема следует настройкам Telegram.',
  homeLink: 'FinTrack — главная',
};

export const quickAdd: Dict['quickAdd'] = {
  expenseHint: 'Покупка, оплата, услуга',
  incomeHint: 'Зарплата, продажа, подарок',
  transferHint: 'Между вашими счетами',
  debtHint: 'Дать или взять в долг',
};

export const language: Dict['language'] = {
  title: 'Язык',
  description: 'Приложение будет показано на этом языке',
};
