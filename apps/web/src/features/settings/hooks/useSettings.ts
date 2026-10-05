import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UpdateProfileInput } from '@fintrack/shared';
import { usersApi } from '../api/users.api';
import { queryKeys } from '../../../lib/queryKeys';
import { useAuthStore } from '../../../stores/authStore';
import { resetSessionCache } from '../../../lib/queryClient';
import { toast } from '../../../stores/toastStore';
import { apiErrorToMessage } from '../../../lib/apiError';
import { exchangeInitData, isMiniAppSession } from '../../../lib/miniAppAuth';
import { useMiniAppStore } from '../../../stores/miniAppStore';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => usersApi.updateProfile(input),
    onSuccess: (user, input) => {
      setUser(user);
      queryClient.setQueryData(queryKeys.auth.me(), user);
      // Time zone decides "today" for every stat; strict mode changes what writes are allowed.
      if (input.timezone !== undefined || input.strictMode !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['stats'] });
        queryClient.invalidateQueries({ queryKey: ['budgets'] });
      }
      toast.success(input.name !== undefined || input.timezone !== undefined ? 'Profil saqlandi' : 'Sozlamalar saqlandi');
    },
    onError: (err) => toast.error(apiErrorToMessage(err)),
  });
}

export function useSessions() {
  return useQuery({ queryKey: queryKeys.auth.sessions(), queryFn: usersApi.sessions });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions() });
      toast.success('Sessiya yakunlandi');
    },
    onError: (err) => toast.error(apiErrorToMessage(err)),
  });
}

/**
 * Resolves to true when the user stays signed in: inside Telegram the launch is still signed by
 * Telegram, so only the other devices are signed out and this app opens a fresh session.
 */
export function useLogoutAll() {
  const { setUser, signIn } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await usersApi.logoutAll();
      if (!isMiniAppSession()) return false;
      const { user } = await exchangeInitData();
      return user;
    },
    onSuccess: (stayed) => {
      if (stayed) {
        signIn(stayed);
        queryClient.setQueryData(queryKeys.auth.me(), stayed);
        toast.success('Boshqa qurilmalardagi sessiyalar yakunlandi');
        return;
      }
      resetSessionCache();
      setUser(null);
    },
    onError: (err) => toast.error(apiErrorToMessage(err)),
  });
}

export function useLinkTelegram() {
  return useMutation({
    mutationFn: usersApi.linkTelegram,
    onError: (err) => toast.error(apiErrorToMessage(err)),
  });
}

export function useDeleteAccount() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: usersApi.deleteAccount,
    onSuccess: () => {
      resetSessionCache();
      setUser(null);
      // Inside Telegram there is no login page: explain how to register again instead.
      if (isMiniAppSession()) useMiniAppStore.getState().setStatus('unregistered');
    },
    onError: (err) => toast.error(apiErrorToMessage(err)),
  });
}
