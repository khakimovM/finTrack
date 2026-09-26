import { Link } from 'react-router-dom';
import { useTransactions } from '../../transactions/hooks/useTransactions';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Amount } from '../../../components/ui/Amount';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ArrowRight, History, ArrowUpRight, ArrowDownRight, ArrowLeftRight } from 'lucide-react';
import { cn } from '../../../lib/utils';

export function RecentTransactionsWidget() {
  const { data, isLoading } = useTransactions({ limit: 5 });
  const transactions = data?.data ?? [];

  return (
    <Card className="border border-border/60 shadow-sm flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Oxirgi Tranzaksiyalar
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-xs h-8 text-primary font-semibold" asChild>
          <Link to="/app/transactions">
            Barchasi <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="pt-0 flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={<History className="h-8 w-8 text-muted-foreground/60" />}
              title="Hozircha yozuvlar yo‘q"
              description="Tranzaksiyalar qo‘shilgach shu yerda aks etadi"
              action={
                <Button size="sm" variant="outline" asChild>
                  <Link to="/app/transactions">+ Tranzaksiya qo‘shish</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {transactions.map((tx) => {
              const isIncome = tx.type === 'INCOME';
              const isExpense = tx.type === 'EXPENSE';
              const isTransfer = tx.type.startsWith('TRANSFER');

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2.5 px-1 hover:bg-muted/30 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl text-base shrink-0',
                        isIncome && 'bg-success/15 text-success',
                        isExpense && 'bg-destructive/15 text-destructive',
                        isTransfer && 'bg-primary/15 text-primary',
                        !isIncome && !isExpense && !isTransfer && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {tx.category?.icon ? (
                        <span>{tx.category.icon}</span>
                      ) : isIncome ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : isExpense ? (
                        <ArrowDownRight className="h-4 w-4" />
                      ) : (
                        <ArrowLeftRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {tx.category?.name ?? tx.note ?? 'Tranzaksiya'}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {tx.account?.name} · {tx.date}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <Amount value={tx.amount} type={tx.type} className="text-xs sm:text-sm font-extrabold" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
