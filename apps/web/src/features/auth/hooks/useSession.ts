import { useQuery } from '@tanstack/react-query';
import type { UserResponse } from '@fintrack/shared';
import { api } from '../../../lib/api';
import { queryKeys } from '../../../lib/queryKeys';

/**
 * The signed-in user, or an error when there is no session. Shared by the app guard and the
 * public pages (the landing shows "Ilovaga o‘tish" instead of "Kirish" when this succeeds).
 */
export function useSessionQuery() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: async () => {
      const res = await api.get<{ data: { user: UserResponse } }>('/auth/me');
      return res.data.data.user;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
