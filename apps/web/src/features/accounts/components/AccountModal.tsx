import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateAccountInput,
  CreateAccountInputSchema,
  AccountResponse,
} from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { useCreateAccount, useUpdateAccount } from '../hooks/useAccounts';
import { cn } from '../../../lib/utils';

const ICONS = ['💳', '💵', '🏦', '💰', '🪙', '💎', '📱', '💼', '🏠', '🚗'];
const COLORS = [
  '#6366f1',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
];

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAccount?: AccountResponse | null;
}

export function AccountModal({ isOpen, onClose, initialAccount }: AccountModalProps) {
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const isEditing = Boolean(initialAccount);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAccountInput>({
    resolver: zodResolver(CreateAccountInputSchema),
    defaultValues: {
      name: '',
      type: 'CARD',
      currency: 'UZS',
      openingBalance: '0',
      icon: '💳',
      color: '#6366f1',
      isDefault: false,
    },
  });

  const selectedIcon = watch('icon');
  const selectedColor = watch('color');

  useEffect(() => {
    if (isOpen) {
      if (initialAccount) {
        reset({
          name: initialAccount.name,
          type: initialAccount.type,
          currency: initialAccount.currency,
          openingBalance: initialAccount.openingBalance,
          icon: initialAccount.icon,
          color: initialAccount.color,
          isDefault: initialAccount.isDefault,
        });
      } else {
        reset({
          name: '',
          type: 'CARD',
          currency: 'UZS',
          openingBalance: '0',
          icon: '💳',
          color: '#6366f1',
          isDefault: false,
        });
      }
    }
  }, [isOpen, initialAccount, reset]);

  const onSubmit = async (data: CreateAccountInput) => {
    if (isEditing && initialAccount) {
      await updateAccount.mutateAsync({
        id: initialAccount.id,
        data: {
          name: data.name,
          type: data.type,
          icon: data.icon,
          color: data.color,
          isDefault: data.isDefault,
        },
      });
    } else {
      await createAccount.mutateAsync(data);
    }
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Hisobni tahrirlash' : 'Yangi hisob ochish'}
      description={
        isEditing
          ? 'Hisob parametrlarini o‘zgartirish'
          : 'Mablag‘laringizni ajratish uchun yangi hamyon yoki karta qo‘shing'
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Hisob nomi"
          placeholder="Masalan: Asosiy karta, Naqd so'm..."
          error={errors.name?.message}
          {...register('name')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Hisob turi" error={errors.type?.message} {...register('type')}>
            <option value="CARD">💳 Bank kartasi</option>
            <option value="CASH">💵 Naqd pul</option>
            <option value="BANK">🏦 Bank hisob raqami</option>
            <option value="SAVINGS">💰 Jamg‘arma / Depozit</option>
          </Select>

          {!isEditing ? (
            <Controller
              name="openingBalance"
              control={control}
              render={({ field }) => (
                <MoneyInput
                  label="Boshlang‘ich balans"
                  value={field.value ?? '0'}
                  onChange={field.onChange}
                  error={errors.openingBalance?.message}
                />
              )}
            />
          ) : (
            <Input
              label="Valyuta"
              value="UZS"
              disabled
              className="opacity-70 cursor-not-allowed"
            />
          )}
        </div>

        {/* Icon picker */}
        <div>
          <label className="text-xs font-semibold text-foreground/80 mb-1.5 block">
            Belgi (Ikonka)
          </label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setValue('icon', icon)}
                className={cn(
                  'h-9 w-9 flex items-center justify-center rounded-xl text-lg transition-transform hover:scale-110',
                  selectedIcon === icon
                    ? 'bg-primary/20 ring-2 ring-primary'
                    : 'bg-muted/40 hover:bg-muted',
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label className="text-xs font-semibold text-foreground/80 mb-1.5 block">
            Rang
          </label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setValue('color', color)}
                style={{ backgroundColor: color }}
                className={cn(
                  'h-7 w-7 rounded-full transition-transform hover:scale-110 shadow-sm',
                  selectedColor === color ? 'ring-2 ring-foreground ring-offset-2' : '',
                )}
              />
            ))}
          </div>
        </div>

        {/* Default checkbox */}
        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            {...register('isDefault')}
          />
          <span className="text-xs text-muted-foreground select-none">
            Asosiy hisob sifatida belgilash
          </span>
        </label>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/80">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Saqlash' : 'Yaratish'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
