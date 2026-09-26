import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateCategoryInput,
  CreateCategoryInputSchema,
} from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useCategories, useCreateCategory } from '../hooks/useCategories';
import { cn } from '../../../lib/utils';

const CATEGORY_ICONS = [
  '🍔', '🛒', '🚗', '🏠', '💊', '🎬', '🎓', '✈️',
  '👔', '📱', '💼', '💰', '📈', '🎁', '🛠️', '☕',
];

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

export interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'INCOME' | 'EXPENSE';
  defaultParentId?: string | null;
}

export function CategoryModal({
  isOpen,
  onClose,
  defaultType = 'EXPENSE',
  defaultParentId = null,
}: CategoryModalProps) {
  const { data: allCategories = [] } = useCategories();
  const createCategory = useCreateCategory();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCategoryInput>({
    resolver: zodResolver(CreateCategoryInputSchema),
    defaultValues: {
      name: '',
      type: defaultType,
      icon: '🍔',
      color: '#ef4444',
      parentId: defaultParentId,
    },
  });

  const selectedType = watch('type');
  const selectedIcon = watch('icon');
  const selectedColor = watch('color');

  // Available parent categories of matching type (only depth 1 can be parents)
  const parentCandidates = allCategories.filter(
    (c) => c.type === selectedType && !c.parentId,
  );

  useEffect(() => {
    if (isOpen) {
      reset({
        name: '',
        type: defaultType,
        icon: defaultType === 'INCOME' ? '💰' : '🍔',
        color: defaultType === 'INCOME' ? '#10b981' : '#ef4444',
        parentId: defaultParentId,
      });
    }
  }, [isOpen, defaultType, defaultParentId, reset]);

  const onSubmit = async (data: CreateCategoryInput) => {
    // If parentId is empty string, convert to null
    const payload = {
      ...data,
      parentId: data.parentId ? data.parentId : null,
    };
    await createCategory.mutateAsync(payload);
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Yangi kategoriya"
      description="Kirim yoki chiqimlar uchun yangi kategoriya yarating"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Type Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/20">
          <button
            type="button"
            onClick={() => setValue('type', 'EXPENSE')}
            className={cn(
              'py-2.5 rounded-xl text-xs font-bold transition-all duration-150',
              selectedType === 'EXPENSE'
                ? 'bg-destructive text-destructive-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Chiqim kategoriyasi
          </button>
          <button
            type="button"
            onClick={() => setValue('type', 'INCOME')}
            className={cn(
              'py-2.5 rounded-xl text-xs font-bold transition-all duration-150',
              selectedType === 'INCOME'
                ? 'bg-success text-success-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Kirim kategoriyasi
          </button>
        </div>

        {/* Category Name */}
        <Input
          label="Kategoriya nomi"
          placeholder="Masalan: Restoranlar, Supermarket..."
          error={errors.name?.message}
          {...register('name')}
        />

        {/* Parent Category (Optional) */}
        <Select
          label="Ota kategoriya (ixtiyoriy)"
          error={errors.parentId?.message}
          {...register('parentId')}
        >
          <option value="">— Asosiy (Ota kategoriya yo‘q) —</option>
          {parentCandidates.map((parent) => (
            <option key={parent.id} value={parent.id}>
              {parent.icon} {parent.name}
            </option>
          ))}
        </Select>

        {/* Icon picker */}
        <div>
          <label className="text-xs font-semibold text-foreground/80 mb-1.5 block">
            Belgi (Ikonka)
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ICONS.map((icon) => (
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
            {CATEGORY_COLORS.map((color) => (
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

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/80">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Yaratish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
