import { useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { BROADCAST_TEXT_MAX, BroadcastSegment } from '@fintrack/shared';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Segmented } from '../../../components/ui/Segmented';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Textarea } from '../../../components/ui/Textarea';
import { useConfirm } from '../../../components/ui/ConfirmDialog';
import { WidgetCard } from '../../dashboard/components/WidgetCard';
import { apiErrorCode, apiErrorToMessage } from '../../../lib/apiError';
import { toast } from '../../../stores/toastStore';
import { formatCount } from '../format';
import { useBroadcastPreview, useBroadcastTest, useCreateBroadcast } from '../hooks/useBroadcasts';

export const SEGMENT_LABELS: Record<BroadcastSegment, string> = {
  ALL: 'Hammasi',
  ACTIVE_30D: '30 kunda faol',
  INACTIVE_30D: '30+ kun faol emas',
};

/**
 * Writing a broadcast: the audience with its exact count, a test to the owner first, then a
 * confirmation that names the number of people. The text sent is the text that was tested.
 */
export function BroadcastComposer({ busy }: { busy: boolean }) {
  const [text, setText] = useState('');
  const [segment, setSegment] = useState<BroadcastSegment>('ALL');
  const [includeOptedOut, setIncludeOptedOut] = useState(false);
  const [testedText, setTestedText] = useState<string | null>(null);
  const preview = useBroadcastPreview({ segment, includeOptedOut });
  const test = useBroadcastTest();
  const create = useCreateBroadcast();
  const [confirmDialog, confirm] = useConfirm();

  const trimmed = text.trim();
  const recipients = preview.data?.recipients ?? 0;
  const tested = trimmed !== '' && testedText === trimmed;

  const sendTest = async () => {
    try {
      await test.mutateAsync(trimmed);
      setTestedText(trimmed);
      toast.success('Test xabar botda — qanday ko‘rinishini tekshiring');
    } catch (err: unknown) {
      toast.error(apiErrorToMessage(err));
    }
  };

  const send = async () => {
    const ok = await confirm({
      title: `${formatCount(recipients)} kishiga yuborilsinmi?`,
      description: `${SEGMENT_LABELS[segment]}${includeOptedOut ? ', bildirishnomani o‘chirganlar ham' : ''}. Boshlangach to‘xtatib bo‘lmaydi; har kimga bir martadan boradi.`,
      confirmLabel: 'Yuborish',
      icon: Megaphone,
    });
    if (!ok) return;
    try {
      await create.mutateAsync({ text: trimmed, segment, includeOptedOut, expectedRecipients: recipients });
      toast.success('Xabar navbatga qo‘yildi');
      setText('');
      setTestedText(null);
    } catch (err: unknown) {
      const code = apiErrorCode(err);
      if (code === 'RECIPIENTS_CHANGED') void preview.refetch();
      if (code === 'BROADCAST_NOT_TESTED') setTestedText(null);
      toast.error(apiErrorToMessage(err));
    }
  };

  const hint = busy
    ? 'Oldingi xabar hali yuborilmoqda.'
    : trimmed === ''
      ? 'Matnni yozing.'
      : !tested
        ? testedText
          ? 'Matn test qilinganidan keyin o‘zgardi: yana o‘zingizga yuboring.'
          : 'Avval o‘zingizga test yuboring.'
        : recipients === 0
          ? 'Bu tanlovda hech kim yo‘q.'
          : null;

  return (
    <WidgetCard title="Yangi xabar">
      <Textarea
        label="Xabar matni"
        hint="Oddiy matn, formatlashsiz; havolalar bosiladigan bo‘ladi."
        rows={6}
        maxLength={BROADCAST_TEXT_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-col gap-3">
        <Segmented
          aria-label="Kimga"
          size="sm"
          value={segment}
          onChange={setSegment}
          options={(Object.keys(SEGMENT_LABELS) as BroadcastSegment[]).map((value) => ({ value, label: SEGMENT_LABELS[value] }))}
          className="self-start"
        />
        <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
          <Checkbox
            aria-label="Bildirishnomalarni o‘chirganlarga ham yuborish"
            checked={includeOptedOut}
            onChange={setIncludeOptedOut}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span>Bildirishnomalarni o‘chirganlarga ham yuborish</span>
            <span className="text-[13px] text-text-muted">Faqat muhim xabarlar uchun: texnik ishlar, xavfsizlik.</span>
          </span>
        </label>
        <div aria-live="polite" className="rounded-[14px] bg-surface px-3.5 py-3 text-[14px]">
          {preview.isLoading ? (
            <Skeleton className="h-5 w-56" />
          ) : preview.isError ? (
            <span className="text-danger">Qabul qiluvchilarni hisoblab bo‘lmadi.</span>
          ) : (
            preview.data && (
              <span className="flex flex-col gap-0.5">
                <span>
                  <b className="tabular-nums">{formatCount(recipients)}</b> kishiga boradi
                </span>
                {(preview.data.excluded.botBlocked > 0 || preview.data.excluded.optedOut > 0) && (
                  <span className="text-[13px] text-text-muted">
                    Bormaydi: {formatCount(preview.data.excluded.botBlocked)} kishi botni bloklagan
                    {!includeOptedOut && `, ${formatCount(preview.data.excluded.optedOut)} kishi bildirishnomani o‘chirgan`}.
                  </span>
                )}
              </span>
            )
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[13px] text-text-secondary">{hint}</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void sendTest()} loading={test.isPending} disabled={trimmed === ''}>
            Menga test yuborish
          </Button>
          <Button onClick={() => void send()} loading={create.isPending} disabled={hint !== null}>
            <Send className="h-4 w-4" aria-hidden />
            Yuborish
          </Button>
        </div>
      </div>
      {confirmDialog}
    </WidgetCard>
  );
}
