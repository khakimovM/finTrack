import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Every cached query belongs to the signed-in user. Drop all of it whenever the identity
 * changes so the next person on a shared device never sees the previous user's data.
 */
export function resetSessionCache(): void {
  queryClient.cancelQueries();
  queryClient.clear();
}
