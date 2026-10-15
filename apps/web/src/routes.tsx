import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LandingPage } from './pages/landing/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ErrorPage } from './pages/ErrorPage';

// Only the landing page (the first page most visitors and every search engine see) is in the main
// bundle; the app, its charts and the admin panel load when someone goes there.

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage />, errorElement: <ErrorPage /> },
  {
    path: '/login',
    lazy: () => import('./pages/auth/LoginPage').then((m) => ({ Component: m.LoginPage })),
    errorElement: <ErrorPage />,
  },
  // Registration happens in the Telegram bot; keep old links working.
  { path: '/register', element: <Navigate to="/login" replace /> },
  {
    path: '/app',
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        lazy: () => import('./components/layout/AppShell').then((m) => ({ Component: m.AppShell })),
        children: [
          { index: true, lazy: () => import('./pages/dashboard/DashboardPage').then((m) => ({ Component: m.DashboardPage })) },
          { path: 'transactions', lazy: () => import('./pages/transactions/TransactionsPage').then((m) => ({ Component: m.TransactionsPage })) },
          { path: 'accounts', lazy: () => import('./pages/accounts/AccountsPage').then((m) => ({ Component: m.AccountsPage })) },
          { path: 'debts', lazy: () => import('./pages/debts/DebtsPage').then((m) => ({ Component: m.DebtsPage })) },
          { path: 'budgets', lazy: () => import('./pages/budgets/BudgetsPage').then((m) => ({ Component: m.BudgetsPage })) },
          { path: 'categories', lazy: () => import('./pages/categories/CategoriesPage').then((m) => ({ Component: m.CategoriesPage })) },
          { path: 'recurring', lazy: () => import('./pages/recurring/RecurringPage').then((m) => ({ Component: m.RecurringPage })) },
          { path: 'reports', lazy: () => import('./pages/reports/ReportsPage').then((m) => ({ Component: m.ReportsPage })) },
          { path: 'notifications', lazy: () => import('./pages/notifications/NotificationsPage').then((m) => ({ Component: m.NotificationsPage })) },
          { path: 'settings', lazy: () => import('./pages/settings/SettingsPage').then((m) => ({ Component: m.SettingsPage })) },
        ],
      },
    ],
  },
  // The owner's admin panel, loaded only when someone opens it: users never download its code.
  {
    path: '/admin/login',
    lazy: () => import('./pages/admin/AdminLoginPage').then((m) => ({ Component: m.AdminLoginPage })),
    errorElement: <ErrorPage />,
  },
  {
    path: '/admin',
    lazy: () => import('./features/admin/components/AdminShell').then((m) => ({ Component: m.AdminShell })),
    errorElement: <ErrorPage />,
    children: [
      { index: true, lazy: () => import('./pages/admin/AdminOverviewPage').then((m) => ({ Component: m.AdminOverviewPage })) },
      { path: 'users', lazy: () => import('./pages/admin/AdminUsersPage').then((m) => ({ Component: m.AdminUsersPage })) },
      { path: 'growth', lazy: () => import('./pages/admin/AdminGrowthPage').then((m) => ({ Component: m.AdminGrowthPage })) },
      { path: 'usage', lazy: () => import('./pages/admin/AdminUsagePage').then((m) => ({ Component: m.AdminUsagePage })) },
      { path: 'broadcasts', lazy: () => import('./pages/admin/AdminBroadcastsPage').then((m) => ({ Component: m.AdminBroadcastsPage })) },
      { path: 'system', lazy: () => import('./pages/admin/AdminSystemPage').then((m) => ({ Component: m.AdminSystemPage })) },
      { path: 'audit', lazy: () => import('./pages/admin/AdminAuditPage').then((m) => ({ Component: m.AdminAuditPage })) },
      { path: '*', lazy: () => import('./features/admin/components/AdminShell').then((m) => ({ Component: m.AdminNotFound })) },
    ],
  },
  // Component gallery for checking the design system; compiled out of production builds.
  ...(import.meta.env.DEV
    ? [{ path: '/dev/ui', lazy: () => import('./pages/dev/UiGallery').then((m) => ({ Component: m.UiGallery })) }]
    : []),
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
