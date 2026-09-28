import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { ToastContainer } from './components/ui/Toast';
import { queryClient } from './lib/queryClient';
import { useMiniAppStore } from './stores/miniAppStore';
import { MiniAppGate } from './features/miniapp/MiniAppGate';

export function App() {
  const miniAppStatus = useMiniAppStore((s) => s.status);
  if (miniAppStatus !== 'off' && miniAppStatus !== 'ready') return <MiniAppGate status={miniAppStatus} />;

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastContainer />
    </QueryClientProvider>
  );
}

export default App;
