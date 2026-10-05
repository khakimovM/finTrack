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

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Only an exact match is active (the home route is a prefix of everything). */
  end?: boolean;
  /** Shows the unread-notification count. */
  badge?: 'notifications';
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/** Sidebar groups as the design orders them. */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: '/app', label: 'Bosh sahifa', icon: House, end: true },
      { to: '/app/transactions', label: 'Tranzaksiyalar', icon: ArrowUpDown },
    ],
  },
  {
    label: 'Pul',
    items: [
      { to: '/app/accounts', label: 'Hisoblar', icon: Wallet },
      { to: '/app/debts', label: 'Qarzlar', icon: Users },
      { to: '/app/recurring', label: 'Takroriy to‘lovlar', icon: Repeat },
    ],
  },
  {
    label: 'Reja va tahlil',
    items: [
      { to: '/app/budgets', label: 'Byudjetlar', icon: ChartPie },
      { to: '/app/reports', label: 'Hisobotlar', icon: ChartColumn },
    ],
  },
  {
    label: 'Sozlash',
    items: [
      { to: '/app/categories', label: 'Kategoriyalar va teglar', icon: Tag },
      { to: '/app/notifications', label: 'Bildirishnomalar', icon: Bell, badge: 'notifications' },
      { to: '/app/settings', label: 'Sozlamalar', icon: SlidersHorizontal },
    ],
  },
];

/** Phone bottom bar: two tabs, the "+" button, then Qarzlar and "Ko‘proq". */
export const TAB_ITEMS: NavItem[] = [
  { to: '/app', label: 'Bosh sahifa', icon: House, end: true },
  { to: '/app/transactions', label: 'Tranzaksiyalar', icon: ArrowUpDown },
  { to: '/app/debts', label: 'Qarzlar', icon: Users },
];

/** The "Ko‘proq" sheet: everything the tab bar has no room for. */
export const MORE_ITEMS: NavItem[] = [
  { to: '/app/accounts', label: 'Hisoblar', icon: Wallet },
  { to: '/app/budgets', label: 'Byudjetlar', icon: ChartPie },
  { to: '/app/recurring', label: 'Takroriy to‘lovlar', icon: Repeat },
  { to: '/app/reports', label: 'Hisobotlar', icon: ChartColumn },
  { to: '/app/categories', label: 'Kategoriyalar va teglar', icon: Tag },
  { to: '/app/settings', label: 'Sozlamalar', icon: SlidersHorizontal },
];
