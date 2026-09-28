import { CalendarClock, Edit2, Pause, Play, Repeat, Trash2, Zap } from 'lucide-react';
import { RecurringRuleResponse } from '@fintrack/shared';
import { Card, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Amount } from '../../../components/ui/Amount';
import { formatDate } from '../../../lib/format';
import { scheduleLabel } from '../recurringLabels';

export interface RecurringRuleCardProps {
  rule: RecurringRuleResponse;
  onRunNow: (rule: RecurringRuleResponse) => void;
  onToggleActive: (rule: RecurringRuleResponse) => void;
  onEdit: (rule: RecurringRuleResponse) => void;
  onDelete: (rule: RecurringRuleResponse) => void;
  busy?: boolean;
}

const ACTION = 'h-11 gap-1.5 px-2 text-xs sm:h-8 sm:px-3';

export function RecurringRuleCard({
  rule,
  onRunNow,
  onToggleActive,
  onEdit,
  onDelete,
  busy,
}: RecurringRuleCardProps) {
  const title = rule.category?.name ?? (rule.type === 'INCOME' ? 'Kirim' : 'Chiqim');
  const icon = rule.category?.icon ?? (rule.type === 'INCOME' ? '💼' : '🔁');

  return (
    <Card className="overflow-hidden border border-border/60 shadow-sm transition-all hover:border-primary/40">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 text-2xl" aria-hidden="true">
              {icon}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-foreground">{title}</h3>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Repeat className="h-3 w-3 shrink-0" />
                <span className="truncate">{scheduleLabel(rule)}</span>
              </p>
            </div>
          </div>
          <Amount value={rule.amount} type={rule.type} className="shrink-0 text-base" />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span>
            {rule.account.icon} {rule.account.name}
          </span>
          {rule.isActive ? (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              Keyingi: <b className="text-foreground">{formatDate(rule.nextRunAt)}</b>
            </span>
          ) : (
            <Badge variant="secondary" className="text-[11px]">
              To‘xtatilgan
            </Badge>
          )}
          {rule.endsAt && <span>{formatDate(rule.endsAt)} gacha</span>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1 border-t border-border/40 pt-3">
          {rule.isActive && (
            <Button
              variant="ghost"
              size="sm"
              className={ACTION}
              disabled={busy}
              onClick={() => onRunNow(rule)}
              aria-label="Hozir bajarish"
            >
              <Zap className="h-3.5 w-3.5" />
              {/* Shorter label on phones so the four actions fit one row. */}
              <span className="sm:hidden">Bajarish</span>
              <span className="hidden sm:inline">Hozir bajarish</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={ACTION}
            disabled={busy}
            onClick={() => onToggleActive(rule)}
          >
            {rule.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {rule.isActive ? 'To‘xtatish' : 'Davom ettirish'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={ACTION}
            disabled={busy}
            onClick={() => onEdit(rule)}
            aria-label="Tahrirlash"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tahrirlash</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`${ACTION} text-destructive hover:bg-destructive/10`}
            disabled={busy}
            onClick={() => onDelete(rule)}
            aria-label="O‘chirish"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">O‘chirish</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
