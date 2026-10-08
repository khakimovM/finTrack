import { useQuery } from '@tanstack/react-query';
import {
  TelegramLoginStartResponse,
  TelegramLoginStatus,
  TelegramLoginStatusResponse,
  UserResponse,
  VerifyTelegramLoginInput,
} from '@fintrack/shared';
import { authApi } from '../api/auth.api';
import { queryKeys } from '../../../lib/queryKeys';

const FINAL_STATUSES: TelegramLoginStatus[] = ['CONSUMED', 'CANCELLED', 'EXPIRED'];

/**
 * The four calls of a Telegram code sign-in. Users and the admin panel go through the same
 * steps on different endpoints, and get back a different thing at the end.
 */
export interface TelegramLoginApi<Result> {
  start: () => Promise<TelegramLoginStartResponse>;
  status: (requestId: string) => Promise<TelegramLoginStatusResponse>;
  verify: (input: VerifyTelegramLoginInput) => Promise<Result>;
  resend: (requestId: string) => Promise<TelegramLoginStatusResponse>;
}

export const userLoginApi: TelegramLoginApi<UserResponse> = {
  start: authApi.startTelegramLogin,
  status: authApi.telegramLoginStatus,
  verify: authApi.verifyTelegramLogin,
  resend: authApi.resendTelegramCode,
};

/** Polls every 2 s while the user is in Telegram; stops once the request reaches a final state. */
export function useTelegramLoginStatus(requestId: string | null, fetchStatus: TelegramLoginApi<unknown>['status'] = userLoginApi.status) {
  return useQuery({
    queryKey: queryKeys.auth.telegramLogin(requestId ?? ''),
    queryFn: () => fetchStatus(requestId ?? ''),
    enabled: requestId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && FINAL_STATUSES.includes(status) ? false : 2000;
    },
    refetchIntervalInBackground: true,
    retry: false,
  });
}
