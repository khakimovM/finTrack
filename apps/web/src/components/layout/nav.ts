import {
  ArrowUpDown,
  Bell,
  ChartColumn,
  ChartPie,
  House,
  Repeat,
  SlidersHorizontal,
  Tag,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { TextKey } from '../../lib/i18n';

export interface NavItem {
  to: string;
  label: TextKey;
  icon: LucideIcon;
  /** Only an exact match is active (the home route is a prefix of everything). */
  end?: boolean;
  /** Shows the unread-notification count. */
  badge?: 'notifications';
}

export interface NavGroup {
  label?: TextKey;
  items: NavItem[];
}

/** Sidebar groups as the design orders them. */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: '/app', label: 'nav.home', icon: House, end: true },
      { to: '/app/transactions', label: 'nav.transactions', icon: ArrowUpDown },
    ],
  },
  {
    label: 'nav.groupMoney',
    items: [
      { to: '/app/accounts', label: 'nav.accounts', icon: Wallet },
      { to: '/app/debts', label: 'nav.debts', icon: Users },
      { to: '/app/recurring', label: 'nav.recurring', icon: Repeat },
    ],
  },
  {
    label: 'nav.groupPlan',
    items: [
      { to: '/app/budgets', label: 'nav.budgets', icon: ChartPie },
      { to: '/app/reports', label: 'nav.reports', icon: ChartColumn },
    ],
  },
  {
    label: 'nav.groupSetup',
    items: [
      { to: '/app/categories', label: 'nav.categories', icon: Tag },
      { to: '/app/notifications', label: 'nav.notifications', icon: Bell, badge: 'notifications' },
      { to: '/app/settings', label: 'nav.settings', icon: SlidersHorizontal },
    ],
  },
];

/** Phone bottom bar: two tabs, the "+" button, then Qarzlar and "Ko‘proq". */
export const TAB_ITEMS: NavItem[] = [
  { to: '/app', label: 'nav.home', icon: House, end: true },
  { to: '/app/transactions', label: 'nav.transactions', icon: ArrowUpDown },
  { to: '/app/debts', label: 'nav.debts', icon: Users },
];

/** The "Ko‘proq" sheet: everything the tab bar has no room for. */
export const MORE_ITEMS: NavItem[] = [
  { to: '/app/accounts', label: 'nav.accounts', icon: Wallet },
  { to: '/app/budgets', label: 'nav.budgets', icon: ChartPie },
  { to: '/app/recurring', label: 'nav.recurring', icon: Repeat },
  { to: '/app/reports', label: 'nav.reports', icon: ChartColumn },
  { to: '/app/categories', label: 'nav.categories', icon: Tag },
  { to: '/app/settings', label: 'nav.settings', icon: SlidersHorizontal },
];
