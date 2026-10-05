import { useState, type FormEvent } from 'react';
import { Info } from 'lucide-react';
import {
  RecurrenceFrequency,
  RecurringRuleResponse,
  UpdateRecurringRuleInput,
  defaultDayOfCycle,
  firstRunDate,
  parseIsoDate,
  todayLocalIso,
} from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { Segmented } from '../../../components/ui/Segmented';
import { ChoiceGrid } from '../../../components/ui/ChoiceGrid';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Textarea } from '../../../components/ui/Textarea';
import { formatAmount } from '../../../lib/money';
import { formatDate, formatDayMonth } from '../../../lib/format';
import { apiErrorCode, apiErrorToMessage } from '../../../lib/apiError';
import { useInitOnOpen } from '../../../lib/useInitOnOpen';
import { useAccounts } from '../../accounts/hooks/useAccounts';
import { useCategories } from '../../categories/hooks/useCategories';
import { useCreateRecurringRule, useUpdateRecurringRule } from '../hooks/useRecurring';
import { FREQUENCY_OPTIONS, ruleTitle } from '../recurringLabels';
import { DayOfCycleField, NextRunPreview } from './RecurringFields';

export interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Edit this rule: only the amount, the day, the end date and the note can change. */
  rule?: RecurringRuleResponse | null;
}

interface Draft {
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  accountId: string;
  categoryId: string;
  frequency: RecurrenceFrequency;
  day: number;
  startsAt: string;
  endsAt: string;
  note: string;
}

const STRICT = 'Hisobda yetarli mablag‘ yo‘q (Qatʼiy rejim)';
const END_BEFORE_START = 'Tugash sanasi boshlanishdan oldin bo‘lishi mumkin emas';

export function RecurringModal({ isOpen, onClose, rule = null }: RecurringModalProps) {
  const editing = rule !== null;
  const today = todayLocalIso();
  const { data: accountsData } = useAccounts();
  const { data: tree = [] } = useCategories();
  const accounts = accountsData?.data ?? [];
  const createRule = useCreateRecurringRule();
  const updateRule = useUpdateRecurringRule();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useInitOnOpen(isOpen, accountsData !== undefined, () => {
    setAmountError(null);
    setError(null);
    if (rule) {
      setDraft({
        type: rule.type,
        amount: rule.amount,
        accountId: rule.accountId,
        categoryId: rule.categoryId ?? '',
        frequency: rule.frequency,
        day: defaultDayOfCycle(rule.frequency, parseIsoDate(rule.startsAt), rule.dayOfCycle) ?? 1,
        startsAt: rule.startsAt,
        endsAt: rule.endsAt ?? '',
        note: rule.note ?? '',
      });
      return;
    }
    setDraft({
      type: 'EXPENSE',
      amount: '',
      accountId: (accounts.find((a) => a.isDefault) ?? accounts[0])?.id ?? '',
      categoryId: '',
      frequency: 'MONTHLY',
      day: Number(today.slice(8, 10)),
      startsAt: today,
      endsAt: '',
      note: '',
    });
  });

  if (!draft) return null;
  const update = (patch: Partial<Draft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  const hasDay = draft.frequency === 'WEEKLY' || draft.frequency === 'MONTHLY';
  // A new weekly rule starts on the weekday it is first booked; keep the grid in step with the start.
  const dayOfCycle = hasDay ? draft.day : null;
  const endError = draft.endsAt && draft.endsAt < draft.startsAt ? END_BEFORE_START : null;
  const dayChanged = rule !== null && hasDay && draft.day !== rule.dayOfCycle;
  const next = endError
    ? null
    : rule && !dayChanged
      ? draft.endsAt && rule.nextRunAt > draft.endsAt
        ? null
        : rule.nextRunAt
      : firstRunDate({ frequency: draft.frequency, startsAt: draft.startsAt, dayOfCycle, endsAt: draft.endsAt || null }, today);
  const busy = createRule.isPending || updateRule.isPending;
  const parents = tree.filter((c) => c.type === draft.type && c.parentId === null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!(/^\d+$/.test(draft.amount) && BigInt(draft.amount) > 0n)) return setAmountError('Summa 0 dan katta bo‘lishi kerak');
    if (endError) return;
    try {
      if (rule) {
        const patch: UpdateRecurringRuleInput = {};
        if (draft.amount !== rule.amount) patch.amount = draft.amount;
        if (dayChanged) patch.dayOfCycle = draft.day;
        if ((draft.endsAt || null) !== rule.endsAt) patch.endsAt = draft.endsAt || null;
        if ((draft.note || null) !== rule.note) patch.note = draft.note || null;
        if (Object.keys(patch).length > 0) await updateRule.mutateAsync({ id: rule.id, data: patch });
      } else {
        await createRule.mutateAsync({
          type: draft.type,
          amount: draft.amount,
          accountId: draft.accountId,
          categoryId: draft.categoryId || null,
          frequency: draft.frequency,
          dayOfCycle,
          startsAt: draft.startsAt,
          endsAt: draft.endsAt || null,
          note: draft.note || null,
        });
      }
      onClose();
    } catch (err) {
      setError(apiErrorCode(err) === 'INSUFFICIENT_BALANCE' ? STRICT : apiErrorToMessage(err));
    }
  };

  const frequencyLabel = FREQUENCY_OPTIONS.find((f) => f.value === draft.frequency)?.label ?? '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Takroriy to‘lovni tahrirlash' : 'Yangi takroriy to‘lov'}
      description={rule ? ruleTitle(rule) : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button type="submit" form="recurring-form" loading={busy}>
            Saqlash
          </Button>
        </>
      }
    >
      <form id="recurring-form" onSubmit={(e) => void submit(e)} className="flex flex-col gap-[18px]" noValidate>
        {rule ? (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-text-secondary">O‘zgarmaydigan maydonlar</span>
            <dl className="flex flex-col rounded-md border border-border bg-surface px-3.5 py-1">
              {[
                ['Turi', rule.type === 'INCOME' ? 'Kirim' : 'Chiqim'],
                ['Hisob', rule.account.name],
                ['Kategoriya', rule.category?.name ?? 'Kategoriyasiz'],
                ['Takrorlanish', frequencyLabel],
                ['Boshlanish', formatDate(rule.startsAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-border py-2.5 text-[14px] last:border-b-0">
                  <dt className="text-text-muted">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[12.5px] leading-[17px] text-text-muted">
              Turi, hisob, kategoriya va takrorlanishni o‘zgartirish uchun yangi qoida yarating.
            </p>
          </div>
        ) : (
          <Segmented
            aria-label="Tur"
            size="lg"
            fullWidth
            value={draft.type}
            onChange={(type) => update({ type, categoryId: '' })}
            options={[
              { value: 'EXPENSE', label: 'Chiqim', tone: 'expense' },
              { value: 'INCOME', label: 'Kirim', tone: 'income' },
            ]}
          />
        )}

        <MoneyInput
          label="Summa"
          size="md"
          autoFocus={!editing}
          value={draft.amount}
          onChange={(amount) => {
            update({ amount });
            setAmountError(null);
          }}
          error={amountError ?? undefined}
        />

        {!rule && (
          <>
            <ChoiceGrid
              label="Hisob"
              columns={2}
              phoneColumns={1}
              value={draft.accountId}
              onChange={(accountId) => update({ accountId })}
              options={accounts.map((a) => ({ value: a.id, label: a.name, emoji: a.icon, color: a.color, sub: formatAmount(a.balance, { sign: 'negative' }) }))}
            />
            <ChoiceGrid
              label="Kategoriya (ixtiyoriy)"
              columns={3}
              phoneColumns={2}
              value={draft.categoryId || 'none'}
              onChange={(id) => update({ categoryId: id === 'none' ? '' : id })}
              options={[
                { value: 'none', label: 'Kategoriyasiz', emoji: '—' },
                ...parents.map((c) => ({ value: c.id, label: c.name, emoji: c.icon, color: c.color })),
              ]}
            />
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-text-secondary">Takrorlanish</span>
              <Segmented
                aria-label="Takrorlanish"
                size="lg"
                fullWidth
                value={draft.frequency}
                onChange={(frequency) =>
                  update({
                    frequency,
                    day: defaultDayOfCycle(frequency, parseIsoDate(draft.startsAt)) ?? draft.day,
                  })
                }
                options={(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const).map((value) => ({
                  value,
                  label: FREQUENCY_OPTIONS.find((f) => f.value === value)?.label ?? value,
                }))}
              />
            </div>
          </>
        )}

        <DayOfCycleField frequency={draft.frequency} value={draft.day} onChange={(day) => update({ day })} />

        {!rule && draft.frequency === 'YEARLY' && (
          <p className="flex gap-2.5 rounded-md bg-info-soft px-3.5 py-3 text-info">
            <Info className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="text-[13.5px] font-medium leading-[19px] text-text">
              Har yili {formatDayMonth(draft.startsAt)} — boshlanish sanasidagi kun va oy olinadi.
            </span>
          </p>
        )}

        {!rule && (
          <DatePicker
            label="Boshlanish"
            value={draft.startsAt}
            onChange={(startsAt) => startsAt && update({ startsAt })}
            chips={['today']}
            min={today}
            today={today}
          />
        )}
        <DatePicker
          label="Tugash (ixtiyoriy)"
          value={draft.endsAt}
          onChange={(endsAt) => update({ endsAt })}
          chips={['none']}
          placeholder="Muddatsiz"
          min={draft.startsAt}
          today={today}
          error={endError ?? undefined}
        />
        <Textarea
          label="Izoh"
          placeholder="Masalan: Uy ijarasi"
          maxLength={500}
          value={draft.note}
          onChange={(e) => update({ note: e.target.value })}
        />
        {!rule && (
          <p className="flex gap-2.5 rounded-md bg-info-soft px-3.5 py-3 text-info">
            <Info className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="text-pretty text-[13.5px] font-medium leading-[19px] text-text">
              O‘tgan sanalar uchun to‘lov yozilmaydi. Birinchi to‘lov kuni bugun bo‘lsa, u darhol yoziladi.
            </span>
          </p>
        )}
        <NextRunPreview next={next} today={today} />
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
