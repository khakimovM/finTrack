import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';
import { resetSessionCache } from './queryClient';
import { exchangeInitData, isMiniAppSession, miniAppAccessToken, miniAppStatusFor } from './miniAppAuth';
import { useMiniAppStore } from '../stores/miniAppStore';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    // Required by the API's CSRF guard on every state-changing request.
    'X-Requested-With': 'XMLHttpRequest',
  },
});

api.interceptors.request.use((config) => {
  const token = miniAppAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

function errorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  return (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code;
}

/**
 * Another tab may rotate the refresh token a moment before this one (REFRESH_RACE). Its new
 * cookie is already shared with us, so the original request can simply be retried.
 */
async function refreshSession(): Promise<void> {
  try {
    await api.post('/auth/refresh');
  } catch (err) {
    if (errorCode(err) !== 'REFRESH_RACE') throw err;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/telegram/') || originalRequest.url?.includes('/auth/refresh');

    // Inside Telegram an expired token is renewed with the launch's initData, not a cookie.
    if (isMiniAppSession() && error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        await exchangeInitData();
      } catch (exchangeError) {
        useMiniAppStore.getState().setStatus(miniAppStatusFor(exchangeError));
        return Promise.reject(exchangeError);
      }
      return api(originalRequest);
    }

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await refreshSession();
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        resetSessionCache();
        useAuthStore.getState().setUser(null);
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
