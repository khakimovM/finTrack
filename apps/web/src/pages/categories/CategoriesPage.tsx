import { useState } from 'react';
import { Plus, Trash2, Layers, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { CategoryResponse, CategoryType } from '@fintrack/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { CategoryModal } from '../../features/categories/components/CategoryModal';
import { useCategories, useDeleteCategory } from '../../features/categories/hooks/useCategories';
import { cn } from '../../lib/utils';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { toast } from '../../stores/toastStore';
import { PageHeader } from '../../components/layout/PageHeader';

export function CategoriesPage() {
  const [confirmDialog, confirm] = useConfirm();
  const [activeTab, setActiveTab] = useState<CategoryType>('EXPENSE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalParentId, setModalParentId] = useState<string | null>(null);

  const { data: categories = [], isLoading, isError, error, refetch } = useCategories();
  const deleteCategory = useDeleteCategory();

  // Filter categories by activeTab
  const filteredCategories = categories.filter((c) => c.type === activeTab);

  const handleOpenAddParent = () => {
    setModalParentId(null);
    setIsModalOpen(true);
  };

  const handleOpenAddSub = (parentId: string) => {
    setModalParentId(parentId);
    setIsModalOpen(true);
  };

  const handleDelete = async (cat: CategoryResponse) => {
    if (cat.isSystem) {
      toast.error('Tizim kategoriyalarini o‘chirib bo‘lmaydi');
      return;
    }
    if (
      await confirm({
        title: `"${cat.name}" kategoriyasi o‘chirilsinmi?`,
        confirmLabel: 'O‘chirish',
        destructive: true,
      })
    ) {
      await deleteCategory.mutateAsync(cat.id);
    }
  };

  const newCategoryButton = (
    <Button onClick={handleOpenAddParent}>
      <Plus className="h-[18px] w-[18px]" aria-hidden />
      Yangi kategoriya
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kategoriyalar va teglar"
        subtitle="Chiqim va kirim kategoriyalari, teglar"
        actions={newCategoryButton}
        mobileActions={newCategoryButton}
      />

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('EXPENSE')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'EXPENSE'
              ? 'border-destructive text-destructive'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <ArrowDownLeft className="h-4 w-4" />
          <span>Chiqimlar ({categories.filter((c) => c.type === 'EXPENSE').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('INCOME')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'INCOME'
              ? 'border-success text-success'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <ArrowUpRight className="h-4 w-4" />
          <span>Kirimlar ({categories.filter((c) => c.type === 'INCOME').length})</span>
        </button>
      </div>

      {/* States */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : 'Kategoriyalarni yuklab bo‘lmadi'}
          onRetry={() => refetch()}
        />
      ) : filteredCategories.length === 0 ? (
        <EmptyState
          title="Kategoriyalar mavjud emas"
          description="Ushbu turdagi birinchi kategoriyangizni yarating."
          action={<Button onClick={handleOpenAddParent}>Kategoriya yaratish</Button>}
        />
      ) : (
        <div className="space-y-4">
          {filteredCategories.map((parent) => (
            <div
              key={parent.id}
              className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm transition-all"
            >
              {/* Parent Category Row */}
              <div className="p-4 flex items-center justify-between gap-4 bg-muted/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-inner"
                    style={{
                      backgroundColor: `${parent.color}20`,
                      color: parent.color,
                    }}
                  >
                    {parent.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm truncate">{parent.name}</h3>
                      {parent.isSystem && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted/60 text-muted-foreground">
                          Standart
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {parent.children?.length ?? 0} ta subkategoriya
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenAddSub(parent.id)}
                    className="h-8 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Subkategoriya</span>
                  </Button>

                  {!parent.isSystem && (
                    <button
                      onClick={() => handleDelete(parent)}
                      disabled={deleteCategory.isPending}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="O‘chirish"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Subcategories (Children) */}
              {parent.children && parent.children.length > 0 ? (
                <div className="p-3 pl-8 sm:pl-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 border-t border-border/40">
                  {parent.children.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-background/50 text-xs hover:bg-muted/20 transition-colors"
                    >
                      <span className="inline-flex items-center gap-2 truncate font-medium">
                        <span>{child.icon}</span>
                        <span className="truncate">{child.name}</span>
                      </span>

                      {!child.isSystem && (
                        <button
                          onClick={() => handleDelete(child)}
                          disabled={deleteCategory.isPending}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          title="Subkategoriyani o‘chirish"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-3 border-t border-border/40 text-xs text-muted-foreground italic flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Subkategoriyalar yo‘q</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Category Modal */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalParentId(null);
        }}
        defaultType={activeTab}
        defaultParentId={modalParentId}
      />
      {confirmDialog}
    </div>
  );
}
