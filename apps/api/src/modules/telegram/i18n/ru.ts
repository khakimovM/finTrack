import { plural } from '@fintrack/shared';
import type { BotTexts } from './index';

export const ru: BotTexts = {
  menu: {
    expense: '➖ Расход',
    income: '➕ Доход',
    balance: '💰 Баланс',
    recent: '📋 Последние операции',
    report: '📊 Отчёт',
    budgets: '🎯 Бюджет',
    debts: '🤝 Долги',
    settings: '⚙️ Настройки',
    app: '🌐 Приложение',
  },
  commands: {
    start: 'Начать / войти',
    menu: 'Меню',
    balans: 'Баланс',
  },
  menuButton: 'Приложение',
  profile: {
    short: (host: string) => `FinTrack — учёт расходов, доходов и долгов. Сайт и приложение: ${host}`,
    long: (site: string) =>
      'Записывайте расходы и доходы сюда одной фразой: «50000 такси», «+8 500 000 зарплата». ' +
      'FinTrack разложит их по категориям и проследит за бюджетами и долгами.\n\n' +
      `Сайт и приложение: ${site}`,
  },
  common: {
    menuIntro:
      'Просто напишите расход или доход, например:\n' +
      '• <code>50000 такси</code>\n• <code>45к обед</code>\n• <code>+8 500 000 зарплата</code>\n• <code>вчера 1,2 млн аренда</code>\n\n' +
      'Или воспользуйтесь меню ниже 👇\n' +
      '<i>Чтобы скрыть или снова открыть меню, нажмите значок кнопок рядом с полем ввода.</i>',
    notRegistered: 'Сначала зарегистрируйтесь: нажмите /start и поделитесь номером.',
    askEntry: (type: 'INCOME' | 'EXPENSE') =>
      type === 'INCOME'
        ? 'Напишите сумму и описание дохода, например: <code>8 500 000 зарплата</code>'
        : 'Напишите сумму и описание расхода, например: <code>50000 такси</code>',
    notUnderstood:
      'Не понял 🤔 Напишите сумму цифрами, например: <code>50000 такси</code> или <code>+2 млн зарплата</code>.',
    draftExpired: 'Этот черновик устарел. Напишите заново.',
    genericError: 'Произошла ошибка. Попробуйте ещё раз чуть позже.',
    today: 'сегодня',
    yesterday: 'вчера',
    noAccount: 'счёт не выбран',
    otherCategory: 'Другое',
    openApp: '🌐 Открыть приложение FinTrack',
    appOnlyOnSite: 'Приложение пока открывается только на сайте.',
    appHint: 'Счета, графики и отчёты — в полном приложении 👇',
  },
  buttons: {
    save: '✅ Сохранить',
    category: '📁 Категория',
    account: '💳 Счёт',
    toExpense: '🔁 В расход',
    toIncome: '🔁 В доход',
    cancel: '❌ Отмена',
    back: '⬅️ Назад',
    undo: '↩️ Отменить',
    confirm: '✅ Подтвердить',
  },
  draft: {
    income: '➕ <b>Доход</b>',
    expense: '➖ <b>Расход</b>',
    noCategory: '<i>категория не выбрана</i>',
    fromVoice: '🎙 Распознано из голоса — проверьте и сохраните.',
    check: 'Всё верно? Нажмите кнопку, чтобы сохранить.',
  },
  entry: {
    cancelledToast: 'Отменено',
    cancelled: '❌ Отменено.',
    undone: '↩️ Запись отменена.',
    pickCategory: 'Сначала выберите категорию',
    savedToast: 'Сохранено ✅',
    saved: (entry: string) => `✅ Сохранено: ${entry}`,
    accountBalance: (account: string, balance: string) => `${account} — баланс: <b>${balance}</b>`,
    budgetAlert: (percent: number, spent: string, limit: string) =>
      `⚠️ Бюджет израсходован на ${percent}% (${spent} / ${limit})`,
  },
  reports: {
    period: { today: 'Сегодня', week: 'Эта неделя', month: 'Этот месяц' },
    periodButton: { today: 'Сегодня', week: 'Неделя', month: 'Месяц' },
    balanceTitle: '💰 <b>Баланс</b>',
    archived: 'в архиве',
    total: 'Итого',
    recentTitle: '📋 <b>Последние операции</b>',
    recentEmpty: '📋 Записей пока нет. Чтобы начать, напишите: <code>50000 такси</code>',
    digestTitle: '🌙 Итоги дня',
    digestEmpty: 'Сегодня ничего не записано. Не забывайте записывать расходы сюда 🙂',
    budgetsEmpty: '🎯 На этот месяц бюджеты не заданы. Добавить их можно в разделе «Бюджеты» в приложении.',
    budgetsTitle: (month: string) => `🎯 <b>Бюджет (${month})</b>`,
    income: 'Доход',
    expense: 'Расход',
    net: 'Чистый итог',
    topExpenses: 'Больше всего потрачено',
    totalBalance: 'Общий баланс',
  },
  debts: {
    // "Вы дали / взяли" keeps the line right whatever the person's gender.
    owesYou: (name: string) => `👤 ${name} — вы дали в долг`,
    youOwe: (name: string) => `👤 ${name} — вы взяли в долг`,
    overdue: (days: number) => `🔴 просрочен на ${days} дн.`,
    due: (date: string) => `срок ${date}`,
    remaining: 'Остаток',
    none: '🤝 Открытых долгов нет. Новый долг можно добавить в разделе «Долги» в приложении.',
    title: '🤝 <b>Долги</b>',
    owedToMe: 'Должны вам',
    iOwe: 'Ваш долг',
    payButton: (name: string) => `💵 ${name}: платёж`,
    settleButton: '✅ Закрыть полностью',
    askAmount: (name: string, remaining: string) =>
      `💵 ${name}: сколько выплачено? Напишите сумму (остаток: ${remaining}).`,
    stale: 'Этот запрос устарел',
    notFound: 'Долг не найден.',
    amountHint: 'Напишите сумму цифрами, например: <code>200000</code> или <code>200 тыс</code>',
    noAccount: 'Сначала создайте активный счёт.',
    settleTitle: '✅ <b>Полное закрытие долга</b>',
    paymentTitle: '💵 <b>Платёж по долгу</b>',
    amountLine: (amount: string, remaining: string) => `Сумма: <b>${amount}</b> (остаток ${remaining})`,
    recordedToast: 'Записано ✅',
    settled: '🎉 Долг полностью закрыт!',
    paid: (amount: string) => `✅ Платёж записан: <b>${amount}</b>`,
  },
  voice: {
    disabled: 'Голосовые сообщения пока не работают. Напишите сумму текстом, например: <code>50000 такси</code>',
    tooLong: (seconds: number) =>
      `Голосовое сообщение должно быть не длиннее ${seconds} ${plural('ru', seconds, {
        one: 'секунды',
        other: 'секунд',
      })}. Запишите покороче и отправьте снова.`,
    tooLarge: 'Файл слишком большой. Отправьте короткое голосовое сообщение.',
    downloadFailed: 'Не удалось загрузить голосовое сообщение. Попробуйте ещё раз чуть позже.',
    limit: 'Дневной лимит голосовых и AI-запросов исчерпан. Попробуйте завтра или напишите текстом, например: <code>50000 такси</code>',
    unavailable: 'Сейчас не получилось разобрать сообщение 😕 Напишите сумму текстом, например: <code>50000 такси</code>',
    heard: (transcript: string) => `🎙 Услышал: «${transcript}»`,
    silence: '🎙 В записи не слышно речи.',
    noAmount: 'Не нашёл сумму. Скажите, например: «на такси двадцать тысяч».',
    several: (count: number) => `Записей: ${count} — проверьте и сохраните каждую 👇`,
    debtHint: 'Дать или взять в долг — это не расход: добавьте долг в разделе «Долги» в приложении.',
  },
  settings: {
    text:
      '⚙️ <b>Настройки</b>\n\n' +
      '<b>Строгий режим</b> — не даёт записать расход больше остатка на счёте.\n' +
      '<b>Уведомления</b> — предупреждения о бюджетах, долгах и регулярных платежах.\n' +
      '<b>Напоминания</b> — каждый день в 7:00; если за день вы не заходили в FinTrack, ещё раз в 22:00.\n' +
      '<b>Итоги дня</b> — каждый вечер доходы и расходы за день.\n' +
      '<b>Месячный отчёт</b> — в последний день месяца в 21:00: итоги месяца текстом и голосовым сообщением.\n' +
      '<b>Язык</b> — на нём с вами говорят бот, сайт и приложение.',
    strict: 'Строгий режим',
    notify: 'Уведомления',
    reminders: 'Напоминания (7:00 / 22:00)',
    digest: 'Итоги дня (21:00)',
    monthly: 'Месячный отчёт',
    logoutAll: '🚪 Выйти на всех устройствах',
    savedToast: 'Сохранено',
    loggedOutAll: 'Сеансы на всех устройствах завершены',
    remindersOff: 'Напоминания выключены. Включить снова: ⚙️ Настройки',
    languageChanged: '🌐 Язык: русский. Меню тоже обновлено 👇',
  },
  reminders: {
    expense: '➖ Записать расход',
    income: '➕ Записать доход',
    off: '🔕 Выключить напоминания',
    friend: 'друг',
  },
  monthly: {
    voiceCaption: '🎧 Послушайте отчёт',
  },
};
