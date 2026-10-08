import { Injectable } from '@nestjs/common';
import { Bot, Context } from 'grammy';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { User } from '@prisma/client';
import { DebtResponse, ListDebtsQuerySchema } from '@fintrack/shared';
import { BotUserService, chatErrorMessage } from '../bot-user.service';
import { DebtPaymentDraft, DraftStore } from '../drafts/draft.store';
import { EntryHandlers } from './entry.handlers';
import { MENU, money, pickerKeyboard } from '../bot-ui';
import { parseQuickEntry } from '../parsing/quick-entry.parser';
import { escapeHtml } from '../../auth/telegram-login.messages';
import { DebtsService } from '../../debts/debts.service';
import { DebtPaymentsService } from '../../debts/debt-payments.service';
import { AccountsRepository } from '../../accounts/accounts.repository';

function debtLine(d: DebtResponse): string {
  const who = d.direction === 'I_LENT' ? `👤 ${escapeHtml(d.personName)} sizga qarzdor` : `👤 Siz ${escapeHtml(d.personName)}ga qarzdorsiz`;
  const due = d.dueDate
    ? d.isOverdue
      ? ` · 🔴 muddati ${Math.abs(d.daysLeft ?? 0)} kun o‘tgan`
      : ` · muddat ${d.dueDate}${d.daysLeft !== null && d.daysLeft <= 3 ? ' 🟡' : ''}`
    : '';
  return `${who}\nQoldiq: <b>${money(d.remainingAmount)}</b> / ${money(d.amount)}${due}`;
}

function confirmKeyboard(draft: DebtPaymentDraft): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '✅ Tasdiqlash', callback_data: `dp:${draft.id}:ok` }],
      [
        { text: '💳 Hisob', callback_data: `dp:${draft.id}:accs` },
        { text: '❌ Bekor', callback_data: `dp:${draft.id}:cancel` },
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
    bot.chatType('private').hears(MENU.debts, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const { data, meta } = await this.debts.list(user.id, ListDebtsQuerySchema.parse({ limit: 8 }));
      const open = data.filter((d) => d.status !== 'PAID');
      if (open.length === 0) {
        await ctx.reply('🤝 Ochiq qarzlar yo‘q. Yangi qarzni ilovadagi “Qarzlar” bo‘limida qo‘shishingiz mumkin.');
        return;
      }
      const header =
        `🤝 <b>Qarzlar</b>\nSizga qarzdorlar: <b>${money(meta.summary.owedToMe)}</b>\n` +
        `Sizning qarzingiz: <b>${money(meta.summary.iOwe)}</b>`;
      await ctx.reply([header, ...open.map(debtLine)].join('\n\n'), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: open.map((d) => [
            { text: `💵 ${d.personName}: to‘lov`, callback_data: `db:${d.id}:pay` },
            { text: '✅ To‘liq yopish', callback_data: `db:${d.id}:settle` },
          ]),
        },
      });
    });

    bot.callbackQuery(/^db:([0-9a-f-]{36}):(pay|settle)$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      try {
        const debt = await this.debts.getById(user.id, ctx.match[1]);
        await ctx.answerCallbackQuery();
        if (ctx.match[2] === 'pay') {
          await this.drafts.setAwaiting(ctx.from.id, { kind: 'debt-payment-amount', debtId: debt.id });
          await ctx.reply(
            `💵 ${escapeHtml(debt.personName)} bo‘yicha qancha to‘landi? Summani yozing (qoldiq: ${money(debt.remainingAmount)}).`,
            { parse_mode: 'HTML' },
          );
        } else {
          await this.sendConfirm(ctx, user, debt, null);
        }
      } catch (err) {
        await ctx.answerCallbackQuery({ text: chatErrorMessage(err), show_alert: true });
      }
    });

    bot.callbackQuery(/^dp:([\w-]{8}):(ok|accs|cancel)$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const [, id, action] = ctx.match;
      try {
        if (action === 'cancel') {
          await this.drafts.consume(id, user.id);
          await ctx.answerCallbackQuery();
          return await ctx.editMessageText('❌ Bekor qilindi.');
        }
        if (action === 'accs') {
          const options = (await this.accounts.findAll(user.id)).map((a) => ({ id: a.id, label: `${a.icon} ${a.name}` }));
          await ctx.answerCallbackQuery();
          return await ctx.editMessageReplyMarkup({
            reply_markup: pickerKeyboard(options, (acc) => `dp:${id}:a:${acc}`, `dp:${id}:back`),
          });
        }
        await this.confirm(ctx, user, id);
      } catch (err) {
        await ctx.answerCallbackQuery({ text: chatErrorMessage(err), show_alert: true });
      }
    });

    bot.callbackQuery(/^dp:([\w-]{8}):(?:a:([0-9a-f-]{36})|back)$/, async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const draft = await this.drafts.get(ctx.match[1], user.id);
      if (!draft || draft.kind !== 'debt-payment') {
        return ctx.answerCallbackQuery({ text: 'Bu so‘rov eskirgan', show_alert: true });
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
        reply_markup: confirmKeyboard(draft),
      });
    });
  }

  private async onAmount(ctx: Context, user: User, text: string, debtId: string): Promise<void> {
    const parsed = parseQuickEntry(text);
    const debt = await this.debts.getById(user.id, debtId).catch(() => null);
    if (!debt) return void (await ctx.reply('Qarz topilmadi.'));
    if (!parsed) {
      await this.drafts.setAwaiting(ctx.from?.id ?? 0, { kind: 'debt-payment-amount', debtId });
      await ctx.reply('Summani raqam bilan yozing, masalan: <code>200000</code> yoki <code>200 ming</code>', {
        parse_mode: 'HTML',
      });
      return;
    }
    await this.sendConfirm(ctx, user, debt, parsed.amount);
  }

  private async sendConfirm(ctx: Context, user: User, debt: DebtResponse, amount: bigint | null): Promise<void> {
    const account = await this.accounts.findDefault(user.id);
    if (!account) return void (await ctx.reply('Avval faol hisob yarating.'));
    const draft = await this.drafts.create({
      kind: 'debt-payment',
      userId: user.id,
      debtId: debt.id,
      amount: amount?.toString() ?? null,
      accountId: account.id,
    });
    await ctx.reply(await this.confirmText(user, debt, draft), {
      parse_mode: 'HTML',
      reply_markup: confirmKeyboard(draft),
    });
  }

  private async confirmText(user: User, debt: DebtResponse, draft: DebtPaymentDraft): Promise<string> {
    const account = await this.accounts.findById(user.id, draft.accountId);
    const amount = draft.amount ?? debt.remainingAmount;
    const title = draft.amount === null ? '✅ <b>Qarzni to‘liq yopish</b>' : '💵 <b>Qarz to‘lovi</b>';
    return [
      title,
      `👤 ${escapeHtml(debt.personName)}`,
      `Summa: <b>${money(amount)}</b> (qoldiq ${money(debt.remainingAmount)})`,
      `💳 ${account ? `${account.icon} ${escapeHtml(account.name)}` : 'hisob tanlanmagan'}`,
    ].join('\n');
  }

  private async confirm(ctx: Context, user: User, draftId: string): Promise<void> {
    const draft = await this.drafts.consume(draftId, user.id);
    if (!draft || draft.kind !== 'debt-payment') {
      await ctx.answerCallbackQuery({ text: 'Bu so‘rov eskirgan', show_alert: true });
      return;
    }
    try {
      const result =
        draft.amount === null
          ? await this.payments.settle(user.id, draft.debtId, { accountId: draft.accountId }, 'BOT')
          : await this.payments.createPayment(user.id, draft.debtId, { amount: draft.amount, accountId: draft.accountId }, 'BOT');
      await ctx.answerCallbackQuery({ text: 'Yozildi ✅' });
      const done = result.debt.status === 'PAID' ? '🎉 Qarz to‘liq yopildi!' : `Qoldiq: <b>${money(result.debt.remainingAmount)}</b>`;
      await ctx.editMessageText(`✅ To‘lov yozildi: <b>${money(result.payment.amount)}</b>\n${done}`, { parse_mode: 'HTML' });
    } catch (err) {
      await this.drafts.save(draft);
      throw err;
    }
  }
}
