import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { telegramApp } from '../../lib/telegram';

const HOME = '/app';

/** Telegram's own Back button replaces browser navigation inside the Mini App. */
export function useTelegramBackButton(): void {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const app = telegramApp();
    if (!app) return;
    if (location.pathname === HOME) {
      app.BackButton.hide();
      return;
    }

    // A deep link has no in-app history: going "back" must not leave the app.
    const onBack = () => {
      const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (index > 0) navigate(-1);
      else navigate(HOME, { replace: true });
    };
    app.BackButton.show();
    app.BackButton.onClick(onBack);
    return () => app.BackButton.offClick(onBack);
  }, [location.pathname, navigate]);
}
