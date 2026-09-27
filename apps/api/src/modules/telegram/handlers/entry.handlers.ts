import { Injectable } from '@nestjs/common';
import { Bot, Context } from 'grammy';
import { User } from '@prisma/client';
import { BotUserService, chatErrorMessage } from '../bot-user.service';
import { EntryService } from '../entry.service';
import { AwaitingState, DraftStore, TransactionDraft } from '../drafts/draft.store';
import { TEXT, draftCard, draftKeyboard, money, pickerKeyboard, signedMoney } from '../bot-ui';
import { escapeHtml } from '../../auth/telegram-login.messages';
import { CreateTransactionResult } from '../../transactions/transactions.service';

/** Handles a text message; returns true when it consumed the message. */
export type TextInterceptor = (ctx: Context, user: User, text: string) => Promise<boolean>;

/** Answers a question the bot asked earlier (e.g. "how much was paid?"). */
export type AwaitingHandler = (
  ctx: Context,
  user: User,
  text: string,
  state: Extract<AwaitingState, { kind: 'debt-payment-amount' }>,
) => Promise<void>;

@Injectable()
export class EntryHandlers {
  private debtAmountHandler: AwaitingHandler | null = null;
  private fallback: TextInterceptor | null = null;

  constructor(
    private readonly users: BotUserService,
    private readonly entries: EntryService,
    private readonly drafts: DraftStore,
  ) {}

  onDebtPaymentAmount(handler: AwaitingHandler): void {
    this.debtAmountHandler = handler;
  }

  /** Called when the deterministic parser gives up (the AI extractor in production). */
  setFallback(handler: TextInterceptor): void {
    this.fallback = handler;
  }

  register(bot: Bot): void {
    bot.callbackQuery(/^d:([\w-]{8}):(save|cats|accs|flip|cancel|back)$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const [, id, action] = ctx.match;
      const draft = await this.entries.get(user, id);
      if (!draft && action !== 'save') return this.expired(ctx);

      try {
        switch (action) {
          case 'save':
            return await this.save(ctx, user, id);
          case 'cancel':
            await this.entries.discard(user, id);
            await ctx.answerCallbackQuery({ text: 'Bekor qilindi' });
            return await ctx.editMessageText('❌ Bekor qilindi.');
          case 'flip':
            return await this.render(ctx, user, await this.entries.flip(user, draft as TransactionDraft));
          case 'cats':
            return await this.showCategories(ctx, user, draft as TransactionDraft);
          case 'accs':
            return await this.showAccounts(ctx, user, draft as TransactionDraft);
          case 'back':
            return await this.render(ctx, user, draft as TransactionDraft);
        }
      } catch (err) {
        await ctx.answerCallbackQuery({ text: chatErrorMessage(err), show_alert: true });
      }
    });

    bot.callbackQuery(/^d:([\w-]{8}):(c|a):([0-9a-f-]{36})$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const [, id, field, value] = ctx.match;
      const draft = await this.entries.get(user, id);
      if (!draft) return this.expired(ctx);

      const options = field === 'c' ? await this.entries.categoryOptions(user, draft.type) : await this.entries.accountOptions(user);
      if (!options.some((o) => o.id === value)) return this.expired(ctx);
      const next = await this.entries.update(draft, field === 'c' ? { categoryId: value } : { accountId: value });
      await this.render(ctx, user, next);
    });

    bot.callbackQuery(/^u:([0-9a-f-]{36})$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      try {
        await this.entries.undo(user, ctx.match[1]);
        await ctx.answerCallbackQuery({ text: 'Bekor qilindi' });
        await ctx.editMessageText('↩️ Yozuv bekor qilindi.');
      } catch (err) {
        await ctx.answerCallbackQuery({ text: chatErrorMessage(err), show_alert: true });
      }
    });
  }

  /** Must be registered after every other text handler (menu buttons, commands). */
  registerTextFallback(bot: Bot): void {
    bot.chatType('private').on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) return;
      const user = await this.users.resolve(ctx);
      if (!user) return;

      // One-shot conversation state is read (and cleared) in exactly one place.
      const awaiting = await this.drafts.takeAwaiting(ctx.from.id);
      if (awaiting?.kind === 'debt-payment-amount' && this.debtAmountHandler) {
        await this.debtAmountHandler(ctx, user, text, awaiting);
        return;
      }
      const forcedType = awaiting?.kind === 'entry' ? awaiting.type : undefined;
      const draft = await this.entries.fromText(user, text, forcedType);
      if (draft) {
        await this.reply(ctx, user, draft);
        return;
      }
      if (this.fallback && (await this.fallback(ctx, user, text))) return;
      await ctx.reply(TEXT.notUnderstood, { parse_mode: 'HTML' });
    });
  }

  /** Sends a fresh draft card (also used by the voice flow). */
  async reply(ctx: Context, user: User, draft: TransactionDraft): Promise<void> {
    const view = await this.entries.view(user, draft);
    await ctx.reply(draftCard(view), { parse_mode: 'HTML', reply_markup: draftKeyboard(draft) });
  }

  private async render(ctx: Context, user: User, draft: TransactionDraft): Promise<void> {
    const view = await this.entries.view(user, draft);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(draftCard(view), { parse_mode: 'HTML', reply_markup: draftKeyboard(draft) });
  }

  private async showCategories(ctx: Context, user: User, draft: TransactionDraft): Promise<void> {
    const options = await this.entries.categoryOptions(user, draft.type);
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({
      reply_markup: pickerKeyboard(options, (id) => `d:${draft.id}:c:${id}`, `d:${draft.id}:back`),
    });
  }

  private async showAccounts(ctx: Context, user: User, draft: TransactionDraft): Promise<void> {
    const options = await this.entries.accountOptions(user);
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({
      reply_markup: pickerKeyboard(options, (id) => `d:${draft.id}:a:${id}`, `d:${draft.id}:back`),
    });
  }

  private async save(ctx: Context, user: User, draftId: string): Promise<void> {
    const outcome = await this.entries.save(user, draftId);
    if (outcome.status === 'expired') return this.expired(ctx);
    if (outcome.status === 'needs-category') {
      await ctx.answerCallbackQuery({ text: 'Avval kategoriyani tanlang' });
      await this.showCategories(ctx, user, outcome.draft);
      return;
    }
    await ctx.answerCallbackQuery({ text: 'Saqlandi ✅' });
    await ctx.editMessageText(this.receipt(outcome.result), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '↩️ Bekor qilish', callback_data: `u:${outcome.result.transaction.id}` }]],
      },
    });
  }

  private receipt({ transaction, accountBalance, budgetAlert }: CreateTransactionResult): string {
    const sign = transaction.type === 'INCOME' ? '➕' : '➖';
    const category = transaction.category ? ` — ${transaction.category.icon} ${escapeHtml(transaction.category.name)}` : '';
    const lines = [
      `✅ Saqlandi: ${sign} <b>${money(transaction.amount)}</b>${category}`,
      `${transaction.account.icon} ${escapeHtml(transaction.account.name)} balansi: <b>${signedMoney(BigInt(accountBalance))}</b>`,
    ];
    if (budgetAlert) {
      lines.push(`⚠️ Byudjet ${budgetAlert.percent}% ishlatildi (${money(budgetAlert.spent)} / ${money(budgetAlert.limit)})`);
    }
    return lines.join('\n');
  }

  private async expired(ctx: Context): Promise<void> {
    await ctx.answerCallbackQuery({ text: TEXT.draftExpired, show_alert: true });
  }
}
