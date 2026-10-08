import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAuthApi } from '../api/adminAuth.api';
import { queryKeys } from '../../../lib/queryKeys';

/** The signed-in admin, or null. Checked once per visit; a 404 later just means it ended. */
export function useAdminSession() {
  return useQuery({
    queryKey: queryKeys.admin.session(),
    queryFn: adminAuthApi.me,
    retry: false,
    staleTime: 60_000,
  });
}

export function useAdminLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminAuthApi.logout,
    onSettled: () => {
      // Nothing admin stays in memory after signing out, whatever the server answered.
      queryClient.removeQueries({ queryKey: queryKeys.admin.all() });
    },
  });
}
