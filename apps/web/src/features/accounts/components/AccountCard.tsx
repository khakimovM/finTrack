import { Edit2, Archive, Star } from 'lucide-react';
import { AccountResponse, AccountType } from '@fintrack/shared';
import { Amount } from '../../../components/ui/Amount';
import { cn } from '../../../lib/utils';

export interface AccountCardProps {
  account: AccountResponse;
  onEdit: (account: AccountResponse) => void;
  onArchive: (id: string) => void;
  isArchiving?: boolean;
}

const TYPE_NAMES: Record<AccountType, string> = {
  CARD: 'Karta',
  CASH: 'Naqd',
  BANK: 'Bank',
  SAVINGS: 'Jamg‘arma',
};

export function AccountCard({
  account,
  onEdit,
  onArchive,
  isArchiving,
}: AccountCardProps) {
  return (
    <div
      className={cn(
        'group relative p-5 rounded-2xl border border-border bg-surface shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between',
        account.isDefault && 'ring-1 ring-primary/40',
      )}
    >
      {/* Top row: Icon, Name, Type, Badges */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-11 w-11 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-inner"
              style={{ backgroundColor: `${account.color}20`, color: account.color }}
            >
              {account.icon}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm tracking-tight truncate">
                  {account.name}
                </h3>
                {account.isDefault && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary"
                    title="Asosiy hisob"
                  >
                    <Star className="h-2.5 w-2.5 fill-primary text-primary" />
                    <span>Asosiy</span>
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                {TYPE_NAMES[account.type]} • {account.currency}
              </span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(account)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Tahrirlash"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onArchive(account.id)}
              disabled={isArchiving}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Arxivlash"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Balance Display */}
        <div className="mt-4">
          <span className="text-xs text-muted-foreground font-medium">Joriy balans</span>
          <div className="mt-0.5">
            <Amount value={account.balance} showSign={false} className="text-xl" />
          </div>
        </div>
      </div>

      {/* Footer stats: Transaction count */}
      <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        <span>Tranzaksiyalar soni</span>
        <span className="font-semibold text-foreground">
          {account.transactionCount} ta
        </span>
      </div>
    </div>
  );
}
