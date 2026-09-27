import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from './components/layout/AuthLayout';
import { RootLayout } from './components/layout/RootLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { TransactionsPage } from './pages/transactions/TransactionsPage';
import { AccountsPage } from './pages/accounts/AccountsPage';
import { CategoriesPage } from './pages/categories/CategoriesPage';
import { DebtsPage } from './pages/debts/DebtsPage';
import { BudgetsPage } from './pages/budgets/BudgetsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ErrorPage } from './pages/ErrorPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/app" replace /> },
      { path: 'login', element: <LoginPage /> },
      // Registration happens in the Telegram bot; keep old links working.
      { path: 'register', element: <Navigate to="/login" replace /> },
    ],
  },
  {
    path: '/app',
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'transactions', element: <TransactionsPage /> },
          { path: 'accounts', element: <AccountsPage /> },
          { path: 'debts', element: <DebtsPage /> },
          { path: 'budgets', element: <BudgetsPage /> },
          { path: 'categories', element: <CategoriesPage /> },
          { path: 'reports', element: <DashboardPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
