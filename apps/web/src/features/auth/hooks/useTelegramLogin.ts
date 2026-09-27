import { useMutation, useQuery } from '@tanstack/react-query';
import { TelegramLoginStatus } from '@fintrack/shared';
import { authApi } from '../api/auth.api';
import { queryKeys } from '../../../lib/queryKeys';

const FINAL_STATUSES: TelegramLoginStatus[] = ['CONSUMED', 'CANCELLED', 'EXPIRED'];

export function useStartTelegramLogin() {
  return useMutation({ mutationFn: authApi.startTelegramLogin });
}

/** Polls every 2 s while the user is in Telegram; stops once the request reaches a final state. */
export function useTelegramLoginStatus(requestId: string | null) {
  return useQuery({
    queryKey: queryKeys.auth.telegramLogin(requestId ?? ''),
    queryFn: () => authApi.telegramLoginStatus(requestId ?? ''),
    enabled: requestId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && FINAL_STATUSES.includes(status) ? false : 2000;
    },
    refetchIntervalInBackground: true,
    retry: false,
  });
}

export function useVerifyTelegramLogin() {
  return useMutation({ mutationFn: authApi.verifyTelegramLogin });
}

export function useResendTelegramCode() {
  return useMutation({ mutationFn: authApi.resendTelegramCode });
}
