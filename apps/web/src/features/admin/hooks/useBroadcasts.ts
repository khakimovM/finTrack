import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BroadcastAudience, CreateBroadcastInput } from '@fintrack/shared';
import { queryKeys } from '../../../lib/queryKeys';
import { adminApi } from '../api/admin.api';

/** Who the message would reach right now; asked again whenever the audience changes. */
export function useBroadcastPreview(audience: BroadcastAudience) {
  return useQuery({
    queryKey: queryKeys.admin.broadcastPreview(audience.segment, audience.includeOptedOut),
    queryFn: () => adminApi.broadcastPreview(audience),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** Sent broadcasts; while one is still going out the list refreshes every two seconds. */
export function useBroadcasts(page: number) {
  return useQuery({
    queryKey: queryKeys.admin.broadcasts(page),
    queryFn: () => adminApi.broadcasts(page),
    placeholderData: keepPreviousData,
    retry: false,
    refetchInterval: (query) => (query.state.data?.data.some((b) => b.status !== 'DONE') ? 2_000 : false),
  });
}

export function useBroadcastTest() {
  return useMutation({ mutationFn: (text: string) => adminApi.broadcastTest(text) });
}

export function useCreateBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBroadcastInput) => adminApi.broadcast(input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'broadcasts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
  });
}
