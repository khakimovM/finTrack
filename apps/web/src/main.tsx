import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { launchedFromTelegram, startTelegram } from './lib/telegram';
import { signInMiniApp } from './features/miniapp/signInMiniApp';
import { MiniAppSplash } from './features/miniapp/MiniAppSplash';

async function bootstrap(): Promise<void> {
  const root = ReactDOM.createRoot(document.getElementById('root')!);

  // Inside Telegram, sign in with the launch data before the router can redirect to /login;
  // the splash covers the script load and the exchange instead of a blank page.
  if (launchedFromTelegram()) {
    root.render(<MiniAppSplash />);
    const telegram = await startTelegram();
    if (telegram) await signInMiniApp(telegram);
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
