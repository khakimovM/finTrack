import { useRouteError, Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function ErrorPage() {
  const error = useRouteError();
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Kutilmagan xatolik yuz berdi';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive shadow-md">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Xatolik yuz berdi</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{errorMessage}</p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sahifani yangilash
        </Button>
        <Button asChild>
          <Link to="/app">Dashboardga o‘tish</Link>
        </Button>
      </div>
    </div>
  );
}
