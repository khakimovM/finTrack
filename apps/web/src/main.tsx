import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { launchedFromTelegram, startTelegram } from './lib/telegram';
import { isAdminPath, signInAdminMiniApp } from './lib/adminMiniApp';
import { signInMiniApp } from './features/miniapp/signInMiniApp';
import { MiniAppSplash } from './features/miniapp/MiniAppSplash';

async function bootstrap(): Promise<void> {
  const root = ReactDOM.createRoot(document.getElementById('root')!);

  // Inside Telegram, sign in with the launch data before the router can redirect to /login;
  // the splash covers the script load and the exchange instead of a blank page. The bot's
  // /admin button opens the admin panel, which signs in as the admin instead of the user.
  if (launchedFromTelegram()) {
    root.render(<MiniAppSplash />);
    const telegram = await startTelegram();
    if (telegram) {
      if (isAdminPath(window.location.pathname)) await signInAdminMiniApp(telegram);
      else await signInMiniApp(telegram);
    }
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
