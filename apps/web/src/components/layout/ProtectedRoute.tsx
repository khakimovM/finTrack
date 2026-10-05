import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSessionQuery } from '../../features/auth/hooks/useSession';
import { MiniAppSplash } from '../../features/miniapp/MiniAppSplash';

export function ProtectedRoute() {
  const location = useLocation();
  const { user, setUser, isAuthenticated, isLoading: isStoreLoading, setLoading } = useAuthStore();
  const { data, isLoading: isQueryLoading, isError } = useSessionQuery();

  useEffect(() => {
    if (data) {
      setUser(data);
    } else if (isError) {
      setUser(null);
    }
  }, [data, isError, setUser]);

  useEffect(() => {
    setLoading(isQueryLoading);
  }, [isQueryLoading, setLoading]);

  // The session is being checked on a fresh load.
  if (isQueryLoading || (isStoreLoading && !user)) return <MiniAppSplash />;

  if (!isAuthenticated && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
