import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <h1 className="text-8xl font-black text-primary/30">404</h1>
      <h2 className="mt-4 text-2xl font-bold tracking-tight">Sahifa topilmadi</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Siz qidirayotgan sahifa mavjud emas yoki boshqa manzilga ko‘chirilgan.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link to="/app">
            <Home className="mr-2 h-4 w-4" />
            Asosiy sahifaga qaytish
          </Link>
        </Button>
      </div>
    </div>
  );
}
