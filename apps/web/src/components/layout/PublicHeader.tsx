import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../brand/Logo';

/** Logo bar of the login and system pages; optionally a way back to the landing page. */
export function PublicHeader({ back = false }: { back?: boolean }) {
  return (
    <header className="flex h-16 items-center justify-between px-4 sm:px-[clamp(16px,2.2vw,32px)]">
      <Link to="/" className="rounded-md focus-ring" aria-label="FinTrack — bosh sahifa">
        <Logo size={30} />
      </Link>
      {back && (
        <Link
          to="/"
          className="flex h-10 items-center gap-1.5 rounded-full pl-2.5 pr-3.5 text-[14px] font-medium text-text-secondary transition-colors duration-fast hover:bg-secondary hover:text-text focus-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Bosh sahifa
        </Link>
      )}
    </header>
  );
}
