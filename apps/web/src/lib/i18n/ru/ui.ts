import type { Dict } from '../uz';

export const ui: Dict['ui'] = {
  pagination: {
    label: 'Страницы',
    shown: 'Показано {first}–{last} из {total}',
    previous: 'Предыдущая страница',
    next: 'Следующая страница',
  },
  delta: {
    new: 'новое',
    unchanged: 'без изменений',
    up: 'Рост {value}',
    down: 'Снижение {value}',
  },
  removeFilter: 'Убрать фильтр «{label}»',
  date: {
    none: 'Без срока',
    placeholder: 'Выберите дату',
    pickStart: 'Выберите дату начала',
    pickEnd: '{from} — выберите дату окончания',
    previousMonth: 'Предыдущий месяц',
    nextMonth: 'Следующий месяц',
    calendar: 'Календарь',
  },
  pickers: {
    fromAccount: 'Счёт отправителя',
    account: 'Выберите счёт',
    category: 'Выберите категорию',
    categorySearch: 'Поиск категории…',
    categorySearchLabel: 'Поиск категории',
    icon: 'Значок',
    color: 'Цвет',
  },
  error: {
    title: 'Не удалось загрузить данные',
    message: 'Проверьте подключение к интернету и попробуйте ещё раз.',
  },
  closeToast: 'Закрыть уведомление',
  drag: 'Перетащить',
};

export const colors: Dict['colors'] = {
  green: 'Зелёный',
  blue: 'Синий',
  yellow: 'Жёлтый',
  purple: 'Фиолетовый',
  cyan: 'Голубой',
  coral: 'Коралловый',
  pink: 'Розовый',
  olive: 'Оливковый',
  gray: 'Серый',
};
