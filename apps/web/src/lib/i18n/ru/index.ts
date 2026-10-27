import type { Dict } from '../uz';
import { accounts, transfer } from './accounts';
import { budgets } from './budgets';
import { landing } from './landing';
import { login } from './login';
import { categories, tags } from './categories';
import { common } from './common';
import { dashboard } from './dashboard';
import { debts } from './debts';
import { notifications } from './notifications';
import { recurring } from './recurring';
import { miniApp, pages, settings } from './settings';
import { reports } from './reports';
import { colors, ui } from './ui';
import { language, nav, quickAdd } from './shell';
import { transactions, txTypes } from './transactions';

export const ru: Dict = {
  common,
  nav,
  quickAdd,
  language,
  ui,
  colors,
  txTypes,
  transactions,
  accounts,
  transfer,
  debts,
  budgets,
  categories,
  tags,
  recurring,
  dashboard,
  reports,
  notifications,
  settings,
  miniApp,
  pages,
  landing,
  login,
};
