import { Injectable } from '@nestjs/common';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { User } from '@prisma/client';
import { CardImportService } from './card-import.service';
import { CardImportRepository } from './card-import.repository';
import { ImportView, LIST_PAGE_SIZE, Mode, Screen, itemScreen, listScreen, pending, summaryScreen, undecided } from './card-ui';
import { pickerKeyboard } from '../bot-ui';
import { userLocale } from '../i18n';
import { AccountsRepository } from '../../accounts/accounts.repository';

/** Which screen of an import to show, and the pickers its buttons open. Null: the import is gone. */
@Injectable()
export class CardScreensService {
  constructor(
    private readonly imports: CardImportService,
    private readonly repository: CardImportRepository,
    private readonly accounts: AccountsRepository,
  ) {}

  summary(user: User, importId: string): Promise<Screen | null> {
    return this.imports.current(user, importId);
  }

  async item(user: User, importId: string, seq: number, mode: Mode): Promise<Screen | null> {
    const view = await this.imports.view(user, importId);
    const op = view?.operations.find((o) => o.seq === seq && o.status === 'PENDING');
    if (!view) return null;
    if (!op) return summaryScreen(view);
    return itemScreen(view, op, mode, this.pageOf(view, seq));
  }

  async list(user: User, importId: string, page: number): Promise<Screen | null> {
    const view = await this.imports.view(user, importId);
    return view ? listScreen(view, page) : null;
  }

  /** In review: the next operation still waiting for an answer, then the summary. In edit: the same one again. */
  async after(user: User, importId: string, seq: number, mode: Mode): Promise<Screen | null> {
    if (mode === 'e') return this.item(user, importId, seq, mode);
    const view = await this.imports.view(user, importId);
    if (!view) return null;
    const queue = undecided(view.operations);
    const next = queue.find((o) => o.seq > seq) ?? queue.find((o) => o.seq !== seq);
    return next ? itemScreen(view, next, 'r', 1) : summaryScreen(view);
  }

  async firstToReview(user: User, importId: string): Promise<Screen | null> {
    const view = await this.imports.view(user, importId);
    if (!view) return null;
    const [first] = undecided(view.operations);
    return first ? itemScreen(view, first, 'r', 1) : summaryScreen(view);
  }

  /** Categories of the operation's own type (expense for money out); `action` is 'c', or 'f' for a fee. */
  async categoryPicker(user: User, importId: string, seq: number, mode: Mode, action: 'c' | 'f'): Promise<InlineKeyboardMarkup | null> {
    const op = await this.repository.findOperation(user.id, importId, seq);
    if (!op || op.status !== 'PENDING') return null;
    const type = action === 'f' || op.direction === 'DEBIT' ? 'EXPENSE' : 'INCOME';
    const options = (await this.imports.categoryList(user.id))
      .filter((c) => c.type === type)
      .map((c) => ({ id: c.id, label: `${c.icon} ${c.name}` }));
    const cb = `ci:${importId}:${mode}${seq}`;
    return pickerKeyboard(options, (id) => `${cb}:${action}:${id}`, `${cb}:v`, userLocale(user));
  }

  /** The person's other accounts; null when there is none to move money to or from. */
  async accountPicker(user: User, importId: string, seq: number, mode: Mode): Promise<InlineKeyboardMarkup | null> {
    const op = await this.repository.findOperation(user.id, importId, seq);
    if (!op || op.status !== 'PENDING') return null;
    const options = (await this.accounts.findAll(user.id))
      .filter((a) => a.id !== op.card.accountId)
      .map((a) => ({ id: a.id, label: `${a.icon} ${a.name}` }));
    if (options.length === 0) return null;
    const cb = `ci:${importId}:${mode}${seq}`;
    return pickerKeyboard(options, (id) => `${cb}:a:${id}`, `${cb}:v`, userLocale(user));
  }

  private pageOf(view: ImportView, seq: number): number {
    const index = pending(view.operations).findIndex((o) => o.seq === seq);
    return index < 0 ? 1 : Math.floor(index / LIST_PAGE_SIZE) + 1;
  }
}
