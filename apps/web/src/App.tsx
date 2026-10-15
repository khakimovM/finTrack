import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ToastContainer } from './components/ui/Toast';
import { queryClient } from './lib/queryClient';
import { useMiniAppStore } from './stores/miniAppStore';
import { MiniAppGate } from './features/miniapp/MiniAppGate';
import { MiniAppSplash } from './features/miniapp/MiniAppSplash';

export function App() {
  const miniAppStatus = useMiniAppStore((s) => s.status);
  if (miniAppStatus !== 'off' && miniAppStatus !== 'ready') return <MiniAppGate status={miniAppStatus} />;

  return (
    <QueryClientProvider client={queryClient}>
      {/* Shown while the first page's code loads (the app's pages are separate chunks). */}
      <RouterProvider router={router} fallbackElement={<MiniAppSplash />} />
      <ToastContainer />
    </QueryClientProvider>
  );
}

export default App;
