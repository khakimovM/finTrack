import { Injectable } from '@nestjs/common';
import { Bot, Context, GrammyError } from 'grammy';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { User } from '@prisma/client';
import { BotUserService, chatErrorMessage } from '../bot-user.service';
import { DraftStore, AwaitingState } from '../drafts/draft.store';
import { EntryHandlers } from './entry.handlers';
import { userLocale } from '../i18n';
import { parseCardMessage } from '../cards/card-message.parser';
import { cardNetworkOf } from '../cards/card-sources';
import { CardIntakeService } from '../cards/card-intake.service';
import { CardImportService } from '../cards/card-import.service';
import { CardImportRepository } from '../cards/card-import.repository';
import { CardDecisionsService, Decision } from '../cards/card-decisions.service';
import { CardLedgerService } from '../cards/card-ledger.service';
import { CardScreensService } from '../cards/card-screens.service';
import { Mode, Screen } from '../cards/card-ui';
import { CARD_TEXTS } from '../cards/card-texts';

const ID = '([\\w-]{8})';
const UUID = '([0-9a-f-]{36})';

/** Forwarded card notifications in, and every button of the import's screens. */
@Injectable()
export class CardHandlers {
  constructor(
    private readonly users: BotUserService,
    private readonly intake: CardIntakeService,
    private readonly imports: CardImportService,
    private readonly repository: CardImportRepository,
    private readonly decisions: CardDecisionsService,
    private readonly ledger: CardLedgerService,
    private readonly screens: CardScreensService,
    private readonly drafts: DraftStore,
    entryHandlers: EntryHandlers,
  ) {
    entryHandlers.onCardDebtPerson((ctx, user, text, state) => this.onDebtPerson(ctx, user, text, state));
  }

  /** Before the free-text entry parser: a forward from a card bot is never a "50000 taksi" entry. */
  register(bot: Bot): void {
    bot.chatType('private').on('message', async (ctx, next) => {
      const text = ctx.message.text ?? ctx.message.caption ?? '';
      const network = cardNetworkOf(ctx.message.forward_origin, text);
      if (!network) return next();
      const user = await this.users.resolve(ctx);
      if (user) await this.intake.ingest(user, text, network);
    });

    // A copied notification, or one forwarded by a person, has no card bot behind it: it is not
    // read as an entry either, the person is asked for the bot's own message instead.
    bot.chatType('private').on('message:text', async (ctx, next) => {
      if (parseCardMessage(ctx.message.text, 'UZCARD').kind !== 'operation') return next();
      const user = await this.users.resolve(ctx);
      if (user) await ctx.reply(CARD_TEXTS[userLocale(user)].pasted, { parse_mode: 'HTML' });
    });

    bot.callbackQuery(new RegExp(`^cm:${ID}:([UH])(\\d{4}):(new|[0-9a-f-]{36})$`), async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const [, id, network, last4, target] = ctx.match;
      await this.run(ctx, user, () => this.imports.mapCard(user, id, network === 'H' ? 'HUMO' : 'UZCARD', last4, target));
    });

    bot.callbackQuery(new RegExp(`^ci:${ID}:(save|rev|sum|cancel|undo|bal|list:\\d{1,3})$`), async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const [, id, action] = ctx.match;
      await this.run(ctx, user, () => this.importAction(ctx, user, id, action));
    });

    bot.callbackQuery(new RegExp(`^ci:${ID}:([re])(\\d{1,4}):(v|x|i|t|d|s|ok|u|n)$`), async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const [, id, mode, seqText, action] = ctx.match;
      await this.run(ctx, user, () => this.itemAction(ctx, user, id, mode as Mode, Number(seqText), action));
    });

    bot.callbackQuery(new RegExp(`^ci:${ID}:([re])(\\d{1,4}):([caf]):${UUID}$`), async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const [, id, mode, seqText, field, value] = ctx.match;
      const decision: Decision =
        field === 'c' ? { kind: 'category', categoryId: value } : field === 'a' ? { kind: 'transfer', accountId: value } : { kind: 'pair', feeCategoryId: value };
      await this.run(ctx, user, () => this.decide(user, id, Number(seqText), mode as Mode, decision));
    });
  }

  private async importAction(ctx: Context, user: User, id: string, action: string): Promise<Screen | null | 'answered'> {
    const t = CARD_TEXTS[userLocale(user)];
    switch (action) {
      case 'save': {
        const outcome = await this.ledger.save(user, id);
        if (outcome.status === 'gone') return null;
        await ctx.answerCallbackQuery({ text: outcome.status === 'saved' ? t.savedToast : t.nothingToSave });
        await this.show(ctx, await this.screens.summary(user, id));
        return 'answered';
      }
      case 'rev':
        return this.screens.firstToReview(user, id);
      case 'cancel':
        await this.repository.discardPending(user.id, id);
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(t.cancelled);
        return 'answered';
      case 'undo':
        if (!(await this.ledger.undo(user, id))) return null;
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(t.undone);
        return 'answered';
      case 'bal': {
        const changed = await this.ledger.reconcile(user, id);
        await ctx.answerCallbackQuery({ text: t.reconciled(changed), show_alert: true });
        await this.show(ctx, await this.screens.summary(user, id));
        return 'answered';
      }
      case 'sum':
        return this.screens.summary(user, id);
      default:
        return this.screens.list(user, id, Number(action.slice('list:'.length)));
    }
  }

  private async itemAction(ctx: Context, user: User, id: string, mode: Mode, seq: number, action: string): Promise<Screen | null | 'answered'> {
    const t = CARD_TEXTS[userLocale(user)];
    switch (action) {
      case 'v':
        return this.screens.item(user, id, seq, mode);
      case 'x':
      case 'i':
        return this.picker(ctx, await this.screens.categoryPicker(user, id, seq, mode, 'c'), t.pickCategory);
      case 't': {
        const keyboard = await this.screens.accountPicker(user, id, seq, mode);
        if (keyboard) return this.picker(ctx, keyboard, t.pickAccount);
        const op = await this.repository.findOperation(user.id, id, seq);
        if (!op) return null;
        await ctx.answerCallbackQuery({ text: t.noOtherAccount, show_alert: true });
        return 'answered';
      }
      case 'd': {
        const op = await this.repository.findOperation(user.id, id, seq);
        if (!op || op.status !== 'PENDING' || !ctx.from) return null;
        await this.drafts.setAwaiting(ctx.from.id, {
          kind: 'card-debt-person',
          importId: id,
          seq,
          mode,
          messageId: ctx.callbackQuery?.message?.message_id,
        });
        await ctx.answerCallbackQuery();
        await ctx.reply(t.askPerson(op.direction === 'DEBIT'));
        return 'answered';
      }
      case 'ok':
        if (await this.decisions.pairNeedsFeeCategory(user, id, seq)) {
          return this.picker(ctx, await this.screens.categoryPicker(user, id, seq, mode, 'f'), t.pickFeeCategory, true);
        }
        return this.decide(user, id, seq, mode, { kind: 'pair' });
      case 's':
        return this.decide(user, id, seq, mode, { kind: 'skip' });
      case 'u':
        if (!(await this.decisions.decide(user, id, seq, { kind: 'split' }))) return null;
        return this.screens.item(user, id, seq, mode);
      default:
        return this.screens.after(user, id, seq, 'r');
    }
  }

  private async decide(user: User, id: string, seq: number, mode: Mode, decision: Decision): Promise<Screen | null> {
    if (!(await this.decisions.decide(user, id, seq, decision))) return null;
    return this.screens.after(user, id, seq, mode);
  }

  private async onDebtPerson(ctx: Context, user: User, text: string, state: Extract<AwaitingState, { kind: 'card-debt-person' }>): Promise<void> {
    const t = CARD_TEXTS[userLocale(user)];
    const person = text.trim();
    if (person.length === 0 || person.length > 100) {
      if (ctx.from) await this.drafts.setAwaiting(ctx.from.id, state);
      await ctx.reply(t.badPerson);
      return;
    }
    const decided = await this.decisions.decide(user, state.importId, state.seq, { kind: 'debt', person });
    const screen = decided ? await this.screens.after(user, state.importId, state.seq, state.mode) : null;
    if (!screen) {
      await ctx.reply(t.expired);
      return;
    }
    const options = { parse_mode: 'HTML' as const, reply_markup: screen.keyboard };
    if (state.messageId && ctx.chat) {
      try {
        await ctx.api.editMessageText(ctx.chat.id, state.messageId, screen.text, options);
        return;
      } catch {
        // The old screen is gone or too old to edit: show the next one as a new message.
      }
    }
    await ctx.reply(screen.text, options);
  }

  /** A picker replaces the screen's buttons and keeps its text, so the operation stays in sight. */
  private async picker(ctx: Context, keyboard: InlineKeyboardMarkup | null, prompt: string, alert = false): Promise<'answered' | null> {
    if (!keyboard) return null;
    await ctx.answerCallbackQuery({ text: prompt, show_alert: alert });
    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    return 'answered';
  }

  /** Runs a button's action: a screen to show, 'answered' when it showed one itself, null when the import is gone. */
  private async run(ctx: Context, user: User, action: () => Promise<Screen | null | 'answered'>): Promise<void> {
    const t = CARD_TEXTS[userLocale(user)];
    try {
      const result = await action();
      if (result === 'answered') return;
      if (result === null) {
        await ctx.answerCallbackQuery({ text: t.expired, show_alert: true });
        return;
      }
      await ctx.answerCallbackQuery();
      await this.show(ctx, result);
    } catch (err) {
      await ctx.answerCallbackQuery({ text: chatErrorMessage(err, userLocale(user)), show_alert: true }).catch(() => undefined);
      throw err;
    }
  }

  private async show(ctx: Context, screen: Screen | null): Promise<void> {
    if (!screen) return;
    try {
      await ctx.editMessageText(screen.text, { parse_mode: 'HTML', reply_markup: screen.keyboard });
    } catch (err) {
      // Tapping a button that leads to the very same screen is not an error.
      if (!(err instanceof GrammyError && err.description.includes('message is not modified'))) throw err;
    }
  }
}
