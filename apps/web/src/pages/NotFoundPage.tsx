import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-text">
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-5 pb-[88px] pt-6">
        <div className="flex max-w-[480px] flex-col items-center gap-4 text-center">
          <span className="text-[clamp(88px,10vw,136px)] font-semibold leading-none tracking-[-0.05em]" aria-hidden>
            4<span className="text-brand">0</span>4
          </span>
          <h1 className="mt-4 text-[clamp(26px,2.2vw,32px)] font-semibold leading-[1.2] tracking-[-0.02em]">Sahifa topilmadi</h1>
          <p className="text-[16px] leading-6 text-text-secondary">
            Siz qidirayotgan sahifa mavjud emas yoki boshqa manzilga ko‘chirilgan.
          </p>
          <Link
            to="/"
            className="mt-3 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-[22px] text-[15px] font-medium text-primary-foreground hover:bg-primary-hover focus-ring"
          >
            <ArrowLeft className="h-[17px] w-[17px]" aria-hidden />
            Asosiy sahifaga qaytish
          </Link>
        </div>
      </main>
    </div>
  );
}
