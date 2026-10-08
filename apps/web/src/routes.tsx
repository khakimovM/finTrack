import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { LandingPage } from './pages/landing/LandingPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { TransactionsPage } from './pages/transactions/TransactionsPage';
import { AccountsPage } from './pages/accounts/AccountsPage';
import { CategoriesPage } from './pages/categories/CategoriesPage';
import { DebtsPage } from './pages/debts/DebtsPage';
import { BudgetsPage } from './pages/budgets/BudgetsPage';
import { RecurringPage } from './pages/recurring/RecurringPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ErrorPage } from './pages/ErrorPage';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage />, errorElement: <ErrorPage /> },
  { path: '/login', element: <LoginPage />, errorElement: <ErrorPage /> },
  // Registration happens in the Telegram bot; keep old links working.
  { path: '/register', element: <Navigate to="/login" replace /> },
  {
    path: '/app',
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'transactions', element: <TransactionsPage /> },
          { path: 'accounts', element: <AccountsPage /> },
          { path: 'debts', element: <DebtsPage /> },
          { path: 'budgets', element: <BudgetsPage /> },
          { path: 'categories', element: <CategoriesPage /> },
          { path: 'recurring', element: <RecurringPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'settings', element: <SettingsPage /> },
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
      { index: true, lazy: () => import('./pages/admin/AdminHomePage').then((m) => ({ Component: m.AdminHomePage })) },
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
