import axios from 'axios';
import { errorText, UNKNOWN_ERROR_TEXT } from '@fintrack/shared';
import { currentLocale } from './i18n';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * What to tell the user about a failed call, in their language: the shared text for the error
 * code, otherwise the API's own message (it answers in the language the request asked for).
 */
export function apiErrorToMessage(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.data) {
    const errorData = (error.response.data as { error?: ApiErrorPayload })?.error;
    const known = errorText(currentLocale(), errorData?.code);
    if (known) return known;
    if (errorData?.message) {
      return errorData.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return UNKNOWN_ERROR_TEXT[currentLocale()];
}

/** The documented error code of a failed API call, when there is one. */
export function apiErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  return (error.response?.data as { error?: ApiErrorPayload } | undefined)?.error?.code;
}
