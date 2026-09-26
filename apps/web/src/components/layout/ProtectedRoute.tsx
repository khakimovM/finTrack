import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UserResponse } from '@fintrack/shared';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import { Skeleton } from '../ui/Skeleton';

export function ProtectedRoute() {
  const location = useLocation();
  const { user, setUser, isAuthenticated, isLoading: isStoreLoading, setLoading } = useAuthStore();

  const { data, isLoading: isQueryLoading, isError } = useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      const res = await api.get<{ data: { user: UserResponse } }>('/auth/me');
      return res.data.data.user;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

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

  // If we are checking the session on fresh load
  if (isQueryLoading || (isStoreLoading && !user)) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-6">
        <div className="flex w-full max-w-sm flex-col items-center space-y-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <span className="text-2xl font-black">FT</span>
          </div>
          <div className="w-full space-y-3">
            <Skeleton className="h-6 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
          </div>
          <div className="w-full space-y-2 pt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
