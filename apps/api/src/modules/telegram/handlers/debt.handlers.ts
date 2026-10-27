import { Injectable } from '@nestjs/common';
import { Bot, Context } from 'grammy';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { User } from '@prisma/client';
import { AppLocale, DebtResponse, ListDebtsQuerySchema } from '@fintrack/shared';
import { BotUserService, chatErrorMessage } from '../bot-user.service';
import { DebtPaymentDraft, DraftStore } from '../drafts/draft.store';
import { EntryHandlers } from './entry.handlers';
import { money, pickerKeyboard } from '../bot-ui';
import { BOT_TEXTS, menuLabels, userLocale } from '../i18n';
import { parseQuickEntry } from '../parsing/quick-entry.parser';
import { escapeHtml } from '../../auth/telegram-login.messages';
import { DebtsService } from '../../debts/debts.service';
import { DebtPaymentsService } from '../../debts/debt-payments.service';
import { AccountsRepository } from '../../accounts/accounts.repository';

function debtLine(d: DebtResponse, locale: AppLocale): string {
  const t = BOT_TEXTS[locale].debts;
  const name = escapeHtml(d.personName);
  const who = d.direction === 'I_LENT' ? t.owesYou(name) : t.youOwe(name);
  const due = d.dueDate
    ? d.isOverdue
      ? ` · ${t.overdue(Math.abs(d.daysLeft ?? 0))}`
      : ` · ${t.due(d.dueDate)}${d.daysLeft !== null && d.daysLeft <= 3 ? ' 🟡' : ''}`
    : '';
  return `${who}\n${t.remaining}: <b>${money(d.remainingAmount, locale)}</b> / ${money(d.amount, locale)}${due}`;
}

function confirmKeyboard(draft: DebtPaymentDraft, locale: AppLocale): InlineKeyboardMarkup {
  const b = BOT_TEXTS[locale].buttons;
  return {
    inline_keyboard: [
      [{ text: b.confirm, callback_data: `dp:${draft.id}:ok` }],
      [
        { text: b.account, callback_data: `dp:${draft.id}:accs` },
        { text: b.cancel, callback_data: `dp:${draft.id}:cancel` },
      ],
    ],
  };
}

/** Debt list, partial payments and settling from the chat. */
@Injectable()
export class DebtHandlers {
  constructor(
    private readonly users: BotUserService,
    private readonly drafts: DraftStore,
    private readonly debts: DebtsService,
    private readonly payments: DebtPaymentsService,
    private readonly accounts: AccountsRepository,
    entryHandlers: EntryHandlers,
  ) {
    entryHandlers.onDebtPaymentAmount((ctx, user, text, state) => this.onAmount(ctx, user, text, state.debtId));
  }

  register(bot: Bot): void {
    bot.chatType('private').hears(menuLabels('debts'), async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const locale = userLocale(user);
      const t = BOT_TEXTS[locale].debts;
      const { data, meta } = await this.debts.list(user.id, ListDebtsQuerySchema.parse({ limit: 8 }));
      const open = data.filter((d) => d.status !== 'PAID');
      if (open.length === 0) {
        await ctx.reply(t.none);
        return;
      }
      const header =
        `${t.title}\n${t.owedToMe}: <b>${money(meta.summary.owedToMe, locale)}</b>\n` +
        `${t.iOwe}: <b>${money(meta.summary.iOwe, locale)}</b>`;
      await ctx.reply([header, ...open.map((d) => debtLine(d, locale))].join('\n\n'), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: open.map((d) => [
            { text: t.payButton(d.personName), callback_data: `db:${d.id}:pay` },
            { text: t.settleButton, callback_data: `db:${d.id}:settle` },
          ]),
        },
      });
    });

    bot.callbackQuery(/^db:([0-9a-f-]{36}):(pay|settle)$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const locale = userLocale(user);
      try {
        const debt = await this.debts.getById(user.id, ctx.match[1]);
        await ctx.answerCallbackQuery();
        if (ctx.match[2] === 'pay') {
          await this.drafts.setAwaiting(ctx.from.id, { kind: 'debt-payment-amount', debtId: debt.id });
          await ctx.reply(
            BOT_TEXTS[locale].debts.askAmount(escapeHtml(debt.personName), money(debt.remainingAmount, locale)),
            { parse_mode: 'HTML' },
          );
        } else {
          await this.sendConfirm(ctx, user, debt, null);
        }
      } catch (err) {
        await ctx.answerCallbackQuery({ text: chatErrorMessage(err, locale), show_alert: true });
      }
    });

    bot.callbackQuery(/^dp:([\w-]{8}):(ok|accs|cancel)$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const [, id, action] = ctx.match;
      const locale = userLocale(user);
      try {
        if (action === 'cancel') {
          await this.drafts.consume(id, user.id);
          await ctx.answerCallbackQuery();
          return await ctx.editMessageText(BOT_TEXTS[locale].entry.cancelled);
        }
        if (action === 'accs') {
          const options = (await this.accounts.findAll(user.id)).map((a) => ({ id: a.id, label: `${a.icon} ${a.name}` }));
          await ctx.answerCallbackQuery();
          return await ctx.editMessageReplyMarkup({
            reply_markup: pickerKeyboard(options, (acc) => `dp:${id}:a:${acc}`, `dp:${id}:back`, locale),
          });
        }
        await this.confirm(ctx, user, id);
      } catch (err) {
        await ctx.answerCallbackQuery({ text: chatErrorMessage(err, locale), show_alert: true });
      }
    });

    bot.callbackQuery(/^dp:([\w-]{8}):(?:a:([0-9a-f-]{36})|back)$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const locale = userLocale(user);
      const draft = await this.drafts.get(ctx.match[1], user.id);
      if (!draft || draft.kind !== 'debt-payment') {
        return ctx.answerCallbackQuery({ text: BOT_TEXTS[locale].debts.stale, show_alert: true });
      }
      const accountId = ctx.match[2];
      if (accountId && (await this.accounts.findActiveById(user.id, accountId))) {
        draft.accountId = accountId;
        await this.drafts.save(draft);
      }
      await ctx.answerCallbackQuery();
      const debt = await this.debts.getById(user.id, draft.debtId);
      await ctx.editMessageText(await this.confirmText(user, debt, draft), {
        parse_mode: 'HTML',
        reply_markup: confirmKeyboard(draft, locale),
      });
    });
  }

  private async onAmount(ctx: Context, user: User, text: string, debtId: string): Promise<void> {
    const t = BOT_TEXTS[userLocale(user)].debts;
    const parsed = parseQuickEntry(text);
    const debt = await this.debts.getById(user.id, debtId).catch(() => null);
    if (!debt) return void (await ctx.reply(t.notFound));
    if (!parsed) {
      await this.drafts.setAwaiting(ctx.from?.id ?? 0, { kind: 'debt-payment-amount', debtId });
      await ctx.reply(t.amountHint, { parse_mode: 'HTML' });
      return;
    }
    await this.sendConfirm(ctx, user, debt, parsed.amount);
  }

  private async sendConfirm(ctx: Context, user: User, debt: DebtResponse, amount: bigint | null): Promise<void> {
    const locale = userLocale(user);
    const account = await this.accounts.findDefault(user.id);
    if (!account) return void (await ctx.reply(BOT_TEXTS[locale].debts.noAccount));
    const draft = await this.drafts.create({
      kind: 'debt-payment',
      userId: user.id,
      debtId: debt.id,
      amount: amount?.toString() ?? null,
      accountId: account.id,
    });
    await ctx.reply(await this.confirmText(user, debt, draft), {
      parse_mode: 'HTML',
      reply_markup: confirmKeyboard(draft, locale),
    });
  }

  private async confirmText(user: User, debt: DebtResponse, draft: DebtPaymentDraft): Promise<string> {
    const locale = userLocale(user);
    const t = BOT_TEXTS[locale];
    const account = await this.accounts.findById(user.id, draft.accountId);
    const amount = draft.amount ?? debt.remainingAmount;
    return [
      draft.amount === null ? t.debts.settleTitle : t.debts.paymentTitle,
      `👤 ${escapeHtml(debt.personName)}`,
      t.debts.amountLine(money(amount, locale), money(debt.remainingAmount, locale)),
      `💳 ${account ? `${account.icon} ${escapeHtml(account.name)}` : t.common.noAccount}`,
    ].join('\n');
  }

  private async confirm(ctx: Context, user: User, draftId: string): Promise<void> {
    const locale = userLocale(user);
    const t = BOT_TEXTS[locale].debts;
    const draft = await this.drafts.consume(draftId, user.id);
    if (!draft || draft.kind !== 'debt-payment') {
      await ctx.answerCallbackQuery({ text: t.stale, show_alert: true });
      return;
    }
    try {
      const result =
        draft.amount === null
          ? await this.payments.settle(user.id, draft.debtId, { accountId: draft.accountId }, 'BOT')
          : await this.payments.createPayment(user.id, draft.debtId, { amount: draft.amount, accountId: draft.accountId }, 'BOT');
      await ctx.answerCallbackQuery({ text: t.recordedToast });
      const done =
        result.debt.status === 'PAID' ? t.settled : `${t.remaining}: <b>${money(result.debt.remainingAmount, locale)}</b>`;
      await ctx.editMessageText(`${t.paid(money(result.payment.amount, locale))}\n${done}`, { parse_mode: 'HTML' });
    } catch (err) {
      await this.drafts.save(draft);
      throw err;
    }
  }
}
