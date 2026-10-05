import { useEffect } from 'react';
import { Link, useRouteError } from 'react-router-dom';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';

/** A render crash: calm words for the user (their data is safe), details only in the console. */
export function ErrorPage() {
  const error = useRouteError();

  useEffect(() => {
    if (import.meta.env.DEV) console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-text">
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-5 pb-[88px] pt-6">
        <div className="flex max-w-[480px] flex-col items-center gap-4 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-danger-soft text-danger">
            <TriangleAlert className="h-8 w-8" strokeWidth={1.8} aria-hidden />
          </span>
          <h1 className="mt-4 text-[clamp(26px,2.2vw,32px)] font-semibold leading-[1.2] tracking-[-0.02em]">Xatolik yuz berdi</h1>
          <p className="text-[16px] leading-6 text-text-secondary">
            Sahifani ko‘rsatishda kutilmagan muammo chiqdi. Maʼlumotlaringiz saqlanib qolgan — sahifani yangilab ko‘ring.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-[22px] text-[15px] font-medium text-primary-foreground hover:bg-primary-hover focus-ring"
            >
              <RotateCcw className="h-[17px] w-[17px]" aria-hidden />
              Sahifani yangilash
            </button>
            <Link
              to="/app"
              className="inline-flex h-12 items-center rounded-full border border-input px-[22px] text-[15px] font-medium hover:bg-secondary focus-ring"
            >
              Bosh sahifaga o‘tish
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
