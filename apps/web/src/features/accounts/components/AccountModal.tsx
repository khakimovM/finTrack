import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { AccountResponse, AccountType, CreateAccountInput, CreateAccountInputSchema, UpdateAccountInput } from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { ChoiceGrid } from '../../../components/ui/ChoiceGrid';
import { EmojiGrid, Swatches } from '../../../components/ui/Pickers';
import { Switch } from '../../../components/ui/Switch';
import { EmojiTile } from '../../../components/ui/EmojiTile';
import { CHART_COLORS } from '../../../lib/colors';
import { apiErrorCode, apiErrorToMessage } from '../../../lib/apiError';
import { useInitOnOpen } from '../../../lib/useInitOnOpen';
import { toast } from '../../../stores/toastStore';
import { useCreateAccount, useUpdateAccount } from '../hooks/useAccounts';
import { ACCOUNT_EMOJIS, ACCOUNT_TYPES } from '../accountTypes';

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAccount?: AccountResponse | null;
}

const NAME_REQUIRED = 'Hisob nomini kiriting';
const NAME_TAKEN = 'Bunday nomli hisob allaqachon mavjud';

const BLANK: CreateAccountInput = {
  name: '',
  type: 'CARD',
  currency: 'UZS',
  openingBalance: '0',
  icon: '💳',
  color: CHART_COLORS[1],
  isDefault: false,
};

/** Create or edit an account. The balance is set once; after that only transactions move it. */
export function AccountModal({ isOpen, onClose, initialAccount = null }: AccountModalProps) {
  const editing = initialAccount !== null;
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const { control, handleSubmit, reset, watch, setError, formState } = useForm<CreateAccountInput>({
    resolver: zodResolver(CreateAccountInputSchema),
    defaultValues: BLANK,
  });

  useInitOnOpen(isOpen, true, () => {
    reset(
      initialAccount
        ? {
            name: initialAccount.name,
            type: initialAccount.type,
            currency: 'UZS',
            openingBalance: initialAccount.openingBalance,
            icon: initialAccount.icon,
            color: initialAccount.color,
            isDefault: initialAccount.isDefault,
          }
        : BLANK,
    );
  });

  const [name, type, icon, color, isDefault] = watch(['name', 'type', 'icon', 'color', 'isDefault']);

  const onSubmit = async (data: CreateAccountInput) => {
    try {
      if (initialAccount) {
        const patch: UpdateAccountInput = {};
        if (data.name !== initialAccount.name) patch.name = data.name;
        if (data.type !== initialAccount.type) patch.type = data.type;
        if (data.icon !== initialAccount.icon) patch.icon = data.icon;
        if (data.color !== initialAccount.color) patch.color = data.color;
        // The API keeps one default; unticking it would only hand the star to another account.
        if (data.isDefault && !initialAccount.isDefault) patch.isDefault = true;
        if (Object.keys(patch).length > 0) await updateAccount.mutateAsync({ id: initialAccount.id, data: patch });
      } else {
        await createAccount.mutateAsync({ ...data, openingBalance: data.openingBalance || '0' });
      }
      onClose();
    } catch (err) {
      if (apiErrorCode(err) === 'ACCOUNT_EXISTS') setError('name', { message: NAME_TAKEN });
      else toast.error(apiErrorToMessage(err));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Hisobni tahrirlash' : 'Yangi hisob'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
            Bekor qilish
          </Button>
          <Button type="submit" form="account-form" loading={formState.isSubmitting}>
            Saqlash
          </Button>
        </>
      }
    >
      <form id="account-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]" noValidate>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
          <EmojiTile emoji={icon} color={color} size={48} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">{name.trim() || 'Hisob nomi'}</span>
            <span className="text-[13px] text-text-muted">{ACCOUNT_TYPES[type].short}</span>
          </div>
          {isDefault && (
            <span className="inline-flex h-[22px] items-center rounded-full bg-warning-soft px-2 text-[12px] font-semibold text-warning">
              ★ Asosiy
            </span>
          )}
        </div>

        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <Input
              {...field}
              label="Hisob nomi"
              placeholder="Masalan: Asosiy karta"
              maxLength={50}
              showCounter
              autoFocus={!editing}
              error={fieldState.error ? (fieldState.error.message === NAME_TAKEN ? NAME_TAKEN : NAME_REQUIRED) : undefined}
            />
          )}
        />

        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <ChoiceGrid
              label="Hisob turi"
              columns={2}
              phoneColumns={2}
              value={field.value}
              onChange={(value) => field.onChange(value as AccountType)}
              options={(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((key) => ({
                value: key,
                label: (
                  <span className="flex items-center gap-2.5">
                    <span className="text-[18px]" aria-hidden>
                      {ACCOUNT_TYPES[key].emoji}
                    </span>
                    {ACCOUNT_TYPES[key].long}
                  </span>
                ),
              }))}
            />
          )}
        />

        {editing ? (
          <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3.5 py-3 text-[14px]">
            <Info className="h-[18px] w-[18px] shrink-0 text-text-secondary" aria-hidden />
            <span className="flex-1">
              <b className="font-semibold">Valyuta: UZS</b>
              <br />
              <span className="text-[12.5px] text-text-muted">Balans tranzaksiyalar orqali o‘zgaradi</span>
            </span>
          </div>
        ) : (
          <Controller
            name="openingBalance"
            control={control}
            render={({ field }) => (
              <MoneyInput
                label="Boshlang‘ich balans"
                size="md"
                value={field.value === '0' ? '' : field.value}
                onChange={field.onChange}
                hint="Valyuta: UZS (O‘zbek so‘mi)"
              />
            )}
          />
        )}

        <Controller
          name="icon"
          control={control}
          render={({ field }) => <EmojiGrid emojis={ACCOUNT_EMOJIS} value={field.value ?? ''} onChange={field.onChange} color={color} />}
        />
        <Controller
          name="color"
          control={control}
          render={({ field }) => <Swatches count={8} value={field.value ?? ''} onChange={field.onChange} />}
        />
        <Controller
          name="isDefault"
          control={control}
          render={({ field }) => (
            <Switch
              checked={Boolean(field.value)}
              onChange={field.onChange}
              disabled={editing && initialAccount?.isDefault}
              label="Asosiy hisob sifatida belgilash"
              description="Yangi tranzaksiyalarda oldindan tanlanadi"
              className="border-t border-border pt-3"
            />
          )}
        />
      </form>
    </Modal>
  );
}
