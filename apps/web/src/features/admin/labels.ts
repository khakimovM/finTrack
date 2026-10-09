import { AdminUsageResponse } from '@fintrack/shared';

type ChannelKey = keyof AdminUsageResponse['activeUsers'] & ('web' | 'miniApp' | 'bot' | 'unknown');
type SourceKey = Exclude<keyof AdminUsageResponse['entries'], 'total'>;

/** Where people use FinTrack, in the order and colours the panel always shows them. */
export const CHANNELS: Array<{ key: ChannelKey; label: string; color: string }> = [
  { key: 'web', label: 'Sayt', color: 'var(--chart-2)' },
  { key: 'miniApp', label: 'Mini App', color: 'var(--chart-5)' },
  { key: 'bot', label: 'Bot', color: 'var(--chart-1)' },
  { key: 'unknown', label: 'Noma’lum', color: 'var(--chart-9)' },
];

/** Where entries are made; "unknown" are the ones from before sources were recorded. */
export const SOURCES: Array<{ key: SourceKey; label: string; color: string }> = [
  { key: 'web', label: 'Sayt', color: 'var(--chart-2)' },
  { key: 'miniApp', label: 'Mini App', color: 'var(--chart-5)' },
  { key: 'bot', label: 'Bot (matn)', color: 'var(--chart-1)' },
  { key: 'voice', label: 'Ovozli xabar', color: 'var(--chart-4)' },
  { key: 'recurring', label: 'Takroriy to‘lov', color: 'var(--chart-3)' },
  { key: 'unknown', label: 'Noma’lum (eski)', color: 'var(--chart-9)' },
];
