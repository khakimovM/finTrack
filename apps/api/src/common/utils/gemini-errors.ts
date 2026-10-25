export interface GeminiErrorBody {
  error?: { message?: string; details?: Array<{ retryDelay?: string }> };
}

/** Google sends no Retry-After header: the delay is in RetryInfo ("44s") or the message. */
export function retryDelaySeconds(body: GeminiErrorBody | null): number | null {
  const fromDetails = body?.error?.details?.find((d) => typeof d.retryDelay === 'string')?.retryDelay;
  const fromMessage = /retry in ([\d.]+)s/i.exec(body?.error?.message ?? '')?.[1];
  const seconds = Number.parseFloat(fromDetails ?? fromMessage ?? '');
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}
