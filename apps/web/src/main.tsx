import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { startTelegram } from './lib/telegram';
import { signInMiniApp } from './features/miniapp/signInMiniApp';

async function bootstrap(): Promise<void> {
  // Inside Telegram, sign in with the launch data before the router can redirect to /login.
  const telegram = await startTelegram();
  if (telegram) await signInMiniApp(telegram);

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
