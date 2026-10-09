import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { BroadcastResponse } from '@fintrack/shared';
import { Chip } from '../../../components/ui/Chip';
import { Progress } from '../../../components/ui/Progress';
import { Pagination } from '../../../components/ui/Pagination';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { WidgetCard, WidgetState } from '../../dashboard/components/WidgetCard';
import { formatDateTime } from '../../../lib/format';
import { formatCount, percentOf } from '../format';
import { useBroadcasts } from '../hooks/useBroadcasts';
import { SEGMENT_LABELS } from './BroadcastComposer';

const STATUS: Record<BroadcastResponse['status'], { label: string; tone: 'neutral' | 'info' | 'success' }> = {
  QUEUED: { label: 'Navbatda', tone: 'neutral' },
  SENDING: { label: 'Yuborilmoqda', tone: 'info' },
  DONE: { label: 'Tugadi', tone: 'success' },
};

function Item({ b }: { b: BroadcastResponse }) {
  const handled = b.total - b.pending;
  const status = STATUS[b.status];
  return (
    <li className="flex flex-col gap-2.5 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 min-w-0 whitespace-pre-line break-words text-[14px] leading-5">{b.text}</p>
        <Chip tone={status.tone} size="sm" dot className="shrink-0">
          {status.label}
        </Chip>
      </div>
      <span className="text-[13px] text-text-muted">
        {SEGMENT_LABELS[b.segment]}
        {b.includeOptedOut && ' (bildirishnomani o‘chirganlar ham)'} · {formatDateTime(b.createdAt)}
        {b.admin && ` · ${b.admin.name}`}
      </span>
      {b.status !== 'DONE' && (
        <Progress value={percentOf(handled, b.total)} tone="info" size="thin" aria-label={`${formatCount(handled)} / ${formatCount(b.total)}`} />
      )}
      <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-secondary tabular-nums">
        <span>
          Yuborildi: <b className="text-text">{formatCount(b.sent)}</b> / {formatCount(b.total)}
        </span>
        {b.blocked > 0 && <span>Bot bloklangan: {formatCount(b.blocked)}</span>}
        {b.failed > 0 && <span className="text-danger">Xato: {formatCount(b.failed)}</span>}
        {b.pending > 0 && <span>Kutmoqda: {formatCount(b.pending)}</span>}
      </span>
    </li>
  );
}

/** Sent broadcasts, newest first, with live progress while one is going out. */
export function BroadcastHistory() {
  const [page, setPage] = useState(1);
  const list = useBroadcasts(page);
  const data = list.data;

  return (
    <WidgetCard title="Yuborilganlar">
      <WidgetState
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        errorTitle="Ro‘yxatni yuklab bo‘lmadi"
        skeleton={<Skeleton className="h-[160px] w-full" />}
      >
        {data && data.data.length > 0 ? (
          <>
            <ul className="flex flex-col divide-y divide-border">
              {data.data.map((b) => (
                <Item key={b.id} b={b} />
              ))}
            </ul>
            {data.meta.totalPages > 1 && (
              <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} onPageChange={setPage} />
            )}
          </>
        ) : (
          <EmptyState variant="widget" icon={<Megaphone className="h-6 w-6" aria-hidden />} title="Hali xabar yuborilmagan" className="min-h-[160px]" />
        )}
      </WidgetState>
    </WidgetCard>
  );
}
