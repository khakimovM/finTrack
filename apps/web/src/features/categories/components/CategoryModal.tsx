import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { CategoryResponse, CategoryType, CreateCategoryInput, CreateCategoryInputSchema, UpdateCategoryInput } from '@fintrack/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Segmented } from '../../../components/ui/Segmented';
import { EmojiGrid, Swatches } from '../../../components/ui/Pickers';
import { FieldError } from '../../../components/ui/Field';
import { CHART_COLORS } from '../../../lib/colors';
import { apiErrorCode, apiErrorToMessage } from '../../../lib/apiError';
import { useInitOnOpen } from '../../../lib/useInitOnOpen';
import { cn } from '../../../lib/utils';
import { toast } from '../../../stores/toastStore';
import { useCategories, useCreateCategory, useUpdateCategory } from '../hooks/useCategories';

export const CATEGORY_EMOJIS = ['🍔', '🛒', '☕', '🍱', '🚗', '🚕', '⛽', '🚇', '🏠', '🔑', '💡', '🎬', '🍿', '📺', '🏥', '💊', '🏋️', '👕', '📱', '🌐', '📞', '📚', '💼', '💻', '🎁', '💰', '✈️', '🐾', '🧾', '🎮'] as const;

const NAME_REQUIRED = 'Kategoriya nomini kiriting';
const NAME_TAKEN = 'Bunday nomli kategoriya allaqachon mavjud';
const TOO_DEEP = 'Kategoriyalar faqat ikki darajali bo‘lishi mumkin';

export interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Edit this category instead of adding one. */
  initialCategory?: CategoryResponse | null;
  defaultType?: CategoryType;
  /** "+ Subkategoriya": the new category goes under this parent. */
  defaultParentId?: string | null;
}

export function CategoryModal({ isOpen, onClose, initialCategory = null, defaultType = 'EXPENSE', defaultParentId = null }: CategoryModalProps) {
  const { data } = useCategories();
  const tree = data ?? [];
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const [depthError, setDepthError] = useState(false);
  const editing = initialCategory !== null;
  // A parent with subcategories cannot move under another one: that would be a third level.
  const hasChildren = (tree.find((c) => c.id === initialCategory?.id)?.children ?? []).length > 0;

  const { control, handleSubmit, reset, watch, setValue, setError, formState } = useForm<CreateCategoryInput>({
    resolver: zodResolver(CreateCategoryInputSchema),
    defaultValues: { name: '', type: defaultType, icon: '🛒', color: CHART_COLORS[0], parentId: null },
  });

  // Waits for the tree: a new subcategory takes its parent's type and colour from it.
  useInitOnOpen(isOpen, data !== undefined, () => {
    setDepthError(false);
    if (initialCategory) {
      reset({
        name: initialCategory.name,
        type: initialCategory.type,
        icon: initialCategory.icon,
        color: initialCategory.color,
        parentId: initialCategory.parentId,
      });
      return;
    }
    const parent = tree.find((c) => c.id === defaultParentId);
    reset({
      name: '',
      type: parent?.type ?? defaultType,
      icon: (parent?.type ?? defaultType) === 'INCOME' ? '💰' : '🛒',
      color: parent?.color ?? CHART_COLORS[0],
      parentId: parent?.id ?? null,
    });
  });

  const [type, parentId, color] = watch(['type', 'parentId', 'color']);
  const parents = tree.filter((c) => c.type === type && c.parentId === null && c.id !== initialCategory?.id);

  const pickParent = (id: string | null) => {
    if (hasChildren && id !== null) {
      setDepthError(true);
      return;
    }
    setDepthError(false);
    setValue('parentId', id);
  };

  const onSubmit = async (data: CreateCategoryInput) => {
    try {
      if (initialCategory) {
        const patch: UpdateCategoryInput = {};
        if (data.name !== initialCategory.name) patch.name = data.name;
        if (data.icon !== initialCategory.icon) patch.icon = data.icon;
        if (data.color !== initialCategory.color) patch.color = data.color;
        if ((data.parentId ?? null) !== initialCategory.parentId) patch.parentId = data.parentId ?? null;
        if (Object.keys(patch).length > 0) await updateCategory.mutateAsync({ id: initialCategory.id, data: patch });
      } else {
        await createCategory.mutateAsync(data);
      }
      onClose();
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === 'CATEGORY_EXISTS') setError('name', { message: NAME_TAKEN });
      else if (code === 'INVALID_CATEGORY_DEPTH') setDepthError(true);
      else toast.error(apiErrorToMessage(err));
    }
  };

  const title = editing ? 'Kategoriyani tahrirlash' : defaultParentId ? 'Yangi subkategoriya' : 'Yangi kategoriya';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
            Bekor qilish
          </Button>
          <Button type="submit" form="category-form" loading={formState.isSubmitting}>
            Saqlash
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]" noValidate>
        <Segmented
          aria-label="Kategoriya turi"
          size="lg"
          fullWidth
          locked={editing}
          lockedHint="Tahrirlashda turini o‘zgartirib bo‘lmaydi"
          value={type}
          onChange={(next) => {
            setValue('type', next);
            setValue('parentId', null);
            setValue('icon', next === 'INCOME' ? '💰' : '🛒');
          }}
          options={[
            { value: 'EXPENSE', label: 'Chiqim kategoriyasi', tone: 'expense' },
            { value: 'INCOME', label: 'Kirim kategoriyasi', tone: 'income' },
          ]}
        />

        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <Input
              {...field}
              label="Kategoriya nomi"
              placeholder="Masalan: Bozorlik"
              maxLength={50}
              showCounter
              autoFocus={!editing}
              error={fieldState.error ? (fieldState.error.message === NAME_TAKEN ? NAME_TAKEN : NAME_REQUIRED) : undefined}
            />
          )}
        />

        <div className="flex flex-col gap-1.5">
          <span id="category-parent-label" className="text-[13px] font-medium text-text-secondary">
            Ota kategoriya (ixtiyoriy)
          </span>
          <div
            role="radiogroup"
            aria-labelledby="category-parent-label"
            className={cn(
              'flex max-h-[208px] flex-col overflow-y-auto rounded-md border border-input bg-card p-1',
              hasChildren && 'opacity-60',
            )}
          >
            {[{ id: null, name: '— Asosiy —', icon: '' }, ...parents].map((option) => {
              const on = (parentId ?? null) === option.id;
              const blocked = hasChildren && option.id !== null;
              return (
                <button
                  key={option.id ?? 'root'}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-disabled={blocked || undefined}
                  onClick={() => pickParent(option.id)}
                  className={cn(
                    'flex min-h-10 items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[14px] focus-ring',
                    option.id ? 'font-medium' : 'font-normal',
                    on && 'bg-secondary',
                    blocked ? 'cursor-not-allowed' : 'hover:bg-secondary',
                  )}
                >
                  <span
                    className={cn('h-4 w-4 shrink-0 rounded-full', on ? 'border-[5px] border-primary' : 'border-[1.5px] border-input')}
                    aria-hidden
                  />
                  {option.icon && (
                    <span className="text-[15px]" aria-hidden>
                      {option.icon}
                    </span>
                  )}
                  <span className="flex-1">{option.name}</span>
                </button>
              );
            })}
          </div>
          {hasChildren && (
            <span className="flex items-center gap-1.5 text-[12.5px] leading-[17px] text-text-muted">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Subkategoriyasi bor kategoriyani boshqasiga ko‘chirib bo‘lmaydi
            </span>
          )}
          {depthError && <FieldError>{TOO_DEEP}</FieldError>}
        </div>

        <Controller
          name="icon"
          control={control}
          render={({ field }) => <EmojiGrid emojis={CATEGORY_EMOJIS} value={field.value ?? ''} onChange={field.onChange} color={color} />}
        />
        <Controller
          name="color"
          control={control}
          render={({ field }) => <Swatches count={9} value={field.value ?? ''} onChange={field.onChange} />}
        />
      </form>
    </Modal>
  );
}
