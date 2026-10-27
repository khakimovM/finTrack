import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FolderOpen, GripVertical, Plus, Tag as TagIcon } from 'lucide-react';
import type { CategoryResponse, CategoryType, TagResponse } from '@fintrack/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Tabs } from '../../components/ui/Tabs';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/layout/PageHeader';
import { useIsMobile } from '../../lib/useMediaQuery';
import { CategoryModal } from '../../features/categories/components/CategoryModal';
import { CategoryTree } from '../../features/categories/components/CategoryTree';
import { useCategories, useDeleteCategory, useReorderCategories } from '../../features/categories/hooks/useCategories';
import { TagsPanel } from '../../features/tags/components/TagsPanel';
import { useDeleteTag, useTags } from '../../features/tags/hooks/useTags';
import { AccountsSkeleton } from '../accounts/AccountsPageParts';
import { t } from '../../lib/i18n';

type Tab = 'expense' | 'income' | 'tags';
const TABS: Tab[] = ['expense', 'income', 'tags'];
const CARD = 'rounded-[20px] border border-border bg-card';

interface FormState {
  category: CategoryResponse | null;
  type: CategoryType;
  parentId: string | null;
}

export function CategoriesPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'expense';
  const [confirmDialog, confirm] = useConfirm();
  const categories = useCategories();
  const tags = useTags();
  const deleteCategory = useDeleteCategory();
  const reorderCategories = useReorderCategories();
  const deleteTag = useDeleteTag();
  const [form, setForm] = useState<FormState | null>(null);
  const [newTagSignal, setNewTagSignal] = useState(0);

  const tree = categories.data ?? [];
  const tagList = tags.data ?? [];
  const expense = tree.filter((c) => c.type === 'EXPENSE');
  const income = tree.filter((c) => c.type === 'INCOME');
  const isTags = tab === 'tags';
  const shown = tab === 'income' ? income : expense;
  const type: CategoryType = tab === 'income' ? 'INCOME' : 'EXPENSE';
  const query = isTags ? tags : categories;

  const openNew = () => (isTags ? setNewTagSignal((n) => n + 1) : setForm({ category: null, type, parentId: null }));

  const removeCategory = async (category: CategoryResponse) => {
    const hasChildren = (tree.find((c) => c.id === category.id)?.children ?? []).length > 0;
    const ok = await confirm({
      title: t('categories.confirm.delete', { name: category.name }),
      description: `${hasChildren ? t('categories.confirm.deleteChildren') : ''}${t('categories.confirm.deleteText')}`,
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) await deleteCategory.mutateAsync(category.id).catch(() => undefined);
  };

  const removeTag = async (tag: TagResponse) => {
    const ok = await confirm({
      title: t('tags.confirmDelete', { name: tag.name }),
      description: t('tags.confirmDeleteText'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) await deleteTag.mutateAsync(tag.id).catch(() => undefined);
  };

  const newLabel = isTags ? t('tags.new') : t('categories.page.new');
  const newButton = (
    <Button onClick={openNew} className={isMobile ? 'h-11 basis-full' : undefined}>
      <Plus className="h-[18px] w-[18px]" aria-hidden />
      {newLabel}
    </Button>
  );

  let body;
  if (query.isLoading) body = <AccountsSkeleton compact={isMobile} />;
  else if (query.isError)
    body = (
      <ErrorState
        title={isTags ? t('tags.loadFailed') : t('categories.page.loadFailed')}
        onRetry={() => void query.refetch()}
        className={CARD}
      />
    );
  else if (isTags)
    body =
      tagList.length === 0 && newTagSignal === 0 ? (
        <EmptyState
          icon={<TagIcon className="h-6 w-6" aria-hidden />}
          title={t('tags.emptyTitle')}
          description={t('tags.emptyText')}
          action={<Button onClick={openNew}>{t('tags.new')}</Button>}
          className={CARD}
        />
      ) : (
        <TagsPanel
          tags={tagList}
          compact={isMobile}
          newTagSignal={newTagSignal}
          onOpen={(tag) => navigate(`/app/transactions?tagId=${encodeURIComponent(tag.id)}`)}
          onDelete={(tag) => void removeTag(tag)}
        />
      );
  else if (shown.length === 0)
    body = (
      <EmptyState
        icon={<FolderOpen className="h-6 w-6" aria-hidden />}
        title={t('categories.page.emptyTitle')}
        description={t('categories.page.emptyText')}
        action={<Button onClick={openNew}>{t('categories.page.new')}</Button>}
        className={CARD}
      />
    );
  else
    body = (
      <CategoryTree
        categories={shown}
        compact={isMobile}
        onAddChild={(parent) => setForm({ category: null, type: parent.type, parentId: parent.id })}
        onEdit={(category) => setForm({ category, type: category.type, parentId: category.parentId })}
        onDelete={(category) => void removeCategory(category)}
        onReorder={(items) => reorderCategories.mutate({ items })}
      />
    );

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <PageHeader title={t('nav.categories')} subtitle={t('categories.page.subtitle')} actions={newButton} />

      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          aria-label={t('categories.page.sections')}
          value={tab}
          fullWidth={isMobile}
          className={isMobile ? 'basis-full' : undefined}
          onChange={(next) => {
            setNewTagSignal(0);
            setParams(next === 'expense' ? {} : { tab: next }, { replace: true });
          }}
          items={[
            { value: 'expense', label: t('categories.page.expense'), count: expense.length },
            { value: 'income', label: t('categories.page.income'), count: income.length },
            { value: 'tags', label: t('categories.page.tags'), count: tagList.length },
          ]}
        />
        {!isMobile && <span className="flex-1" />}
        {isMobile && newButton}
        {!isMobile && !isTags && shown.length > 1 && (
          <span className="flex items-center gap-1.5 text-[13px] text-text-muted">
            <GripVertical className="h-4 w-4" aria-hidden />
            {t('categories.page.dragHint')}
          </span>
        )}
      </div>

      {body}

      <CategoryModal
        isOpen={form !== null}
        onClose={() => setForm(null)}
        initialCategory={form?.category ?? null}
        defaultType={form?.type ?? type}
        defaultParentId={form?.parentId ?? null}
      />
      {confirmDialog}
    </div>
  );
}
