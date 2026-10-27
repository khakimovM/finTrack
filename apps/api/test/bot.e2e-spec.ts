import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, categoryId, firstAccountId, newUser, today } from './helpers/api-client';
import { callbackUpdate, contactUpdate, FakeTgUser, textUpdate } from './helpers/fake-telegram';
import { DailyDigestService } from '../src/modules/telegram/outbox/daily-digest.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { BOT_TEXTS } from '../src/modules/telegram/i18n';
import { LOGIN_TEXTS } from '../src/modules/auth/telegram-login.messages';

interface TxRow {
  id: string;
  type: string;
  amount: string;
  note: string | null;
  category: { name: string } | null;
}

describe('Managing money from the Telegram bot (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const tg = (client: ApiClient): FakeTgUser => {
    if (!client.telegramUser) throw new Error('client has no Telegram identity');
    return client.telegramUser;
  };
  const say = (client: ApiClient, text: string) => ctx.deliver(textUpdate(tg(client), text));
  const tap = (client: ApiClient, data: string) => ctx.deliver(callbackUpdate(tg(client), data));
  const lastText = (client: ApiClient) => ctx.telegram.last(tg(client).id).text;
  const button = (client: ApiClient, pattern: RegExp) => ctx.telegram.button(tg(client).id, pattern);
  const lastAnswer = () => ctx.telegram.callbackAnswers().at(-1);

  async function transactions(client: ApiClient): Promise<TxRow[]> {
    return (await client.get('/transactions?limit=50')).body.data as TxRow[];
  }

  /** Types an entry, confirms the draft card and returns the stored transaction. */
  async function quickAdd(client: ApiClient, text: string): Promise<TxRow> {
    await say(client, text);
    await tap(client, button(client, /^d:[\w-]{8}:save$/));
    const undo = button(client, /^u:[0-9a-f-]{36}$/);
    const tx = (await transactions(client)).find((t) => t.id === undo.slice(2));
    if (!tx) throw new Error('saved transaction not found');
    return tx;
  }

  describe('quick entry', () => {
    it('turns "50000 taksi" into a draft and stores nothing until it is confirmed', async () => {
      const user = await newUser(ctx);

      await say(user, '50000 taksi');
      const card = lastText(user);
      expect(card).toContain('Chiqim');
      expect(card).toContain('50 000 so‘m');
      expect(card).toContain('Transport');
      expect(await transactions(user)).toHaveLength(0);

      await tap(user, button(user, /^d:[\w-]{8}:save$/));
      const [tx] = await transactions(user);
      expect(tx).toMatchObject({ type: 'EXPENSE', amount: '5000000', note: 'taksi', category: { name: 'Transport' } });
      expect(lastText(user)).toContain('✅ Saqlandi');
      expect(lastText(user)).toContain('➖ <b>50 000 so‘m</b>');
      expect(lastText(user)).toContain('balansi: <b>−50 000 so‘m</b>');
    });

    it('undo removes exactly the stored transaction', async () => {
      const user = await newUser(ctx);
      const tx = await quickAdd(user, '+2 mln oylik');
      expect(tx).toMatchObject({ type: 'INCOME', amount: '200000000', category: { name: 'Oylik' } });

      await tap(user, `u:${tx.id}`);
      expect(await transactions(user)).toHaveLength(0);
      expect(lastText(user)).toContain('bekor qilindi');
    });

    it('a draft is saved once even if the button is tapped twice', async () => {
      const user = await newUser(ctx);
      await say(user, '12 ming non');
      const save = button(user, /^d:[\w-]{8}:save$/);

      await Promise.all([tap(user, save), tap(user, save)]);
      expect(await transactions(user)).toHaveLength(1);
    });

    it('the menu button forces the entry type and the card lets the user change fields', async () => {
      const user = await newUser(ctx);
      const acc = (await user.post('/accounts', { name: 'Humo', type: 'CARD', openingBalance: '0' })).body.data.id as string;

      await say(user, '➕ Kirim');
      await say(user, '300 ming');
      expect(lastText(user)).toContain('Kirim');
      expect(lastText(user)).toContain('kategoriya tanlanmagan');

      // Saving without a category opens the picker instead of storing an uncategorised row.
      await tap(user, button(user, /^d:[\w-]{8}:save$/));
      expect(lastAnswer()).toBe('Avval kategoriyani tanlang');
      expect(await transactions(user)).toHaveLength(0);

      const oylik = await categoryId(user, 'Oylik');
      await tap(user, button(user, new RegExp(`^d:[\\w-]{8}:c:${oylik}$`)));
      await tap(user, button(user, /^d:[\w-]{8}:accs$/));
      await tap(user, button(user, new RegExp(`^d:[\\w-]{8}:a:${acc}$`)));
      expect(lastText(user)).toContain('Humo');

      await tap(user, button(user, /^d:[\w-]{8}:save$/));
      const res = await user.get(`/transactions?accountId=${acc}`);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ type: 'INCOME', amount: '30000000', category: { name: 'Oylik' } });
    });

    it('another user cannot confirm, edit or undo my drafts and transactions', async () => {
      const owner = await newUser(ctx);
      const stranger = await newUser(ctx);
      await say(owner, '70000 taksi');
      const draftId = /^d:([\w-]{8}):save$/.exec(button(owner, /^d:[\w-]{8}:save$/))?.[1];
      const ownerAccount = await firstAccountId(owner);

      await tap(stranger, `d:${draftId}:save`);
      await tap(stranger, `d:${draftId}:a:${ownerAccount}`);
      expect(await transactions(owner)).toHaveLength(0);
      expect(await transactions(stranger)).toHaveLength(0);

      await tap(owner, `d:${draftId}:save`);
      const [tx] = await transactions(owner);
      await tap(stranger, `u:${tx.id}`);
      expect(await transactions(owner)).toHaveLength(1);
    });

    it('strict mode refuses an overdraft and keeps the draft for another try', async () => {
      const user = await newUser(ctx);
      await say(user, '⚙️ Sozlamalar');
      await tap(user, 'set:strict');
      expect((await user.get('/auth/me')).body.data.user.strictMode).toBe(true);

      await say(user, '50000 taksi');
      const save = button(user, /^d:[\w-]{8}:save$/);
      await tap(user, save);
      expect(lastAnswer()).toBe('Balansingiz yetarli emas');
      expect(await transactions(user)).toHaveLength(0);

      await quickAdd(user, '+100 ming bonus');
      await tap(user, save);
      expect((await transactions(user)).filter((t) => t.type === 'EXPENSE')).toHaveLength(1);
    });

    it('explains the format when the message is not an entry, and ignores unknown people', async () => {
      const user = await newUser(ctx);
      await say(user, 'salom');
      expect(lastText(user)).toContain('Tushunmadim');

      const stranger = ctx.telegram.newUser('Stranger');
      await ctx.deliver(textUpdate(stranger, '50000 taksi'));
      expect(ctx.telegram.last(stranger.id).text).toContain('ro‘yxatdan o‘ting');
    });
  });

  describe('menu', () => {
    it('shows balance, recent entries and the monthly report from the ledger', async () => {
      const user = await newUser(ctx);
      await quickAdd(user, '+1 mln oylik');
      await quickAdd(user, '250 ming ijara');

      await say(user, '💰 Balans');
      expect(lastText(user)).toContain('Jami: <b>750 000 so‘m</b>');

      // Money on an archived account is in the total, so it is listed too; an empty one is not.
      const box = await user.post('/accounts', { name: 'Eski karta', type: 'CARD', openingBalance: '10000000' });
      const empty = await user.post('/accounts', { name: 'Bo‘sh karta', type: 'CARD' });
      await user.post(`/accounts/${box.body.data.id}/archive`, {});
      await user.post(`/accounts/${empty.body.data.id}/archive`, {});
      await say(user, '💰 Balans');
      expect(lastText(user)).toContain('Eski karta <i>(arxivda)</i>: <b>100 000 so‘m</b>');
      expect(lastText(user)).not.toContain('Bo‘sh karta');
      expect(lastText(user)).toContain('Jami: <b>850 000 so‘m</b>');

      await say(user, '📋 Oxirgi amallar');
      expect(lastText(user)).toContain('−250 000 so‘m');
      expect(lastText(user)).toContain('+1 000 000 so‘m');

      await say(user, '📊 Hisobot');
      expect(lastText(user)).toContain('Kirim: <b>1 000 000 so‘m</b>');
      expect(lastText(user)).toContain('Chiqim: <b>250 000 so‘m</b>');
      expect(lastText(user)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      await tap(user, 'r:today');
      expect(lastText(user)).toContain('Bugun');
    });

    it('settings toggles are stored on the profile the web app reads', async () => {
      const user = await newUser(ctx);
      await say(user, '⚙️ Sozlamalar');
      await tap(user, 'set:digest');
      await tap(user, 'set:notify');
      await tap(user, 'set:reminders');
      await tap(user, 'set:monthly');

      const me = (await user.get('/auth/me')).body.data.user;
      expect(me).toMatchObject({ dailyDigest: true, notifyTelegram: false, dailyReminders: false, monthlyReport: false });
    });

    it('"log out everywhere" ends the web sessions', async () => {
      const user = await newUser(ctx);
      await say(user, '⚙️ Sozlamalar');
      await tap(user, 'set:logoutall');

      expect((await user.get('/auth/me')).status).toBe(401);
    });
  });

  describe('debts', () => {
    it('records a partial payment and then settles the rest from the chat', async () => {
      const user = await newUser(ctx);
      await quickAdd(user, '+500 ming oylik');
      const acc = await firstAccountId(user);
      const created = await user.post('/debts', { direction: 'I_LENT', personName: 'Jasur', accountId: acc, amount: '10000000' });
      const debtId = created.body.data.debt.id as string;

      await say(user, '🤝 Qarzlar');
      expect(lastText(user)).toContain('Jasur');
      await tap(user, `db:${debtId}:pay`);
      await say(user, '40 ming');
      expect(lastText(user)).toContain('40 000 so‘m');
      await tap(user, button(user, /^dp:[\w-]{8}:ok$/));

      let debt = (await user.get(`/debts/${debtId}`)).body.data;
      expect(debt).toMatchObject({ remainingAmount: '6000000', status: 'PARTIALLY_PAID' });

      await tap(user, `db:${debtId}:settle`);
      await tap(user, button(user, /^dp:[\w-]{8}:ok$/));
      debt = (await user.get(`/debts/${debtId}`)).body.data;
      expect(debt).toMatchObject({ remainingAmount: '0', status: 'PAID' });
      expect(lastText(user)).toContain('to‘liq yopildi');

      // Repayments move the balance but never show up as income.
      const report = await user.get(`/stats/summary?from=${today()}&to=${today()}`);
      expect(report.body.data.periodIncome).toBe('50000000');
    });

    it('rejects an overpayment without writing anything', async () => {
      const user = await newUser(ctx);
      const acc = await firstAccountId(user);
      const created = await user.post('/debts', { direction: 'I_BORROWED', personName: 'Aka', accountId: acc, amount: '1000000' });
      const debtId = created.body.data.debt.id as string;

      await tap(user, `db:${debtId}:pay`);
      await say(user, '50 ming');
      await tap(user, button(user, /^dp:[\w-]{8}:ok$/));

      expect(lastAnswer()).toBe('Qoldiqdan ortiqcha to‘lov kiritib bo‘lmaydi');
      const debt = (await user.get(`/debts/${debtId}`)).body.data;
      expect(debt.remainingAmount).toBe('1000000');
    });
  });

  describe('notifications', () => {
    async function waitFor<T>(read: () => Promise<T | null | undefined>, timeoutMs = 10_000): Promise<T> {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const value = await read();
        if (value) return value;
        if (Date.now() > deadline) throw new Error('timed out');
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    it('pushes a budget warning to Telegram exactly once', async () => {
      const user = await newUser(ctx);
      await quickAdd(user, '+1 mln oylik');
      await user.post('/budgets', {
        categoryId: await categoryId(user, 'Transport'),
        month: today().slice(0, 7),
        limitAmount: '10000000',
      });

      const tx = await quickAdd(user, '85 ming taksi');
      expect(tx.type).toBe('EXPENSE');
      const receipt = ctx.telegram.outputs(tg(user).id).filter((o) => o.text.startsWith('✅ Saqlandi')).at(-1);
      expect(receipt?.text).toContain('Byudjet 85% ishlatildi');

      const sent = await waitFor(() =>
        ctx.prisma.notification.findFirst({ where: { userId: user.userId, type: 'BUDGET_WARNING', telegramSentAt: { not: null } } }),
      );
      expect(sent).toBeTruthy();
      const pushes = ctx.telegram.messagesTo(tg(user).id).filter((m) => m.startsWith('🟡'));
      expect(pushes).toHaveLength(1);
    });

    it('does not push to users who turned Telegram notifications off', async () => {
      const user = await newUser(ctx);
      await say(user, '⚙️ Sozlamalar');
      await tap(user, 'set:notify');
      await user.post('/budgets', {
        categoryId: await categoryId(user, 'Oziq-ovqat'),
        month: today().slice(0, 7),
        limitAmount: '100',
      });
      await quickAdd(user, '5 ming non');

      const stored = await waitFor(() =>
        ctx.prisma.notification.findFirst({ where: { userId: user.userId, type: 'BUDGET_EXCEEDED' } }),
      );
      await new Promise((r) => setTimeout(r, 500));
      const after = await ctx.prisma.notification.findUniqueOrThrow({ where: { id: stored.id } });
      expect(after.telegramSentAt).toBeNull();
      expect(ctx.telegram.messagesTo(tg(user).id).some((m) => m.startsWith('🔴'))).toBe(false);
    });

    it('reminds in the morning everyone who kept reminders on, and at night only those quiet all day', async () => {
      const [quiet, active, off, digest, banned, blocked] = await Promise.all(
        Array.from({ length: 6 }, () => newUser(ctx)),
      );
      expect((await active.get('/auth/me')).body.data.user.dailyReminders).toBe(true);
      expect((await off.patch('/users/me', { dailyReminders: false })).body.data.user.dailyReminders).toBe(false);
      await digest.patch('/users/me', { dailyDigest: true });
      await ctx.prisma.user.update({ where: { id: banned.userId }, data: { bannedAt: new Date() } });
      await ctx.prisma.user.update({ where: { id: blocked.userId }, data: { telegramBlockedAt: new Date() } });

      // Signing up counts as using FinTrack that day; forget it for the one who stayed away.
      const { day } = await ctx.prisma.userActivityDay.findFirstOrThrow({ where: { userId: active.userId } });
      await ctx.prisma.userActivityDay.deleteMany({ where: { userId: { in: [quiet.userId, digest.userId] } } });

      const users = ctx.app.get(UsersRepository);
      const ours = [quiet, active, off, digest, banned, blocked].map((c) => c.userId);
      const pick = async (quietOn?: Date) =>
        (await users.findReminderRecipients(quietOn)).map((u) => u.id).filter((id) => ours.includes(id)).sort();

      expect(await pick()).toEqual([quiet.userId, active.userId, digest.userId].sort());
      expect(await pick(day)).toEqual([quiet.userId]);
    });

    it('the buttons under a reminder start an entry or switch the reminders off', async () => {
      const user = await newUser(ctx);

      await tap(user, 'rem:expense');
      expect(lastText(user)).toContain('Chiqim summasi va izohini yozing');
      await say(user, '15000 kofe');
      expect(lastText(user)).toContain('15 000 so‘m');
      await tap(user, 'rem:income');
      expect(lastText(user)).toContain('Kirim summasi va izohini yozing');

      await tap(user, 'rem:off');
      expect(lastAnswer()).toBe('Eslatmalar o‘chirildi. Qayta yoqish: ⚙️ Sozlamalar');
      expect(ctx.telegram.last(tg(user).id)).toMatchObject({
        method: 'editMessageReplyMarkup',
        buttons: ['rem:expense', 'rem:income'],
      });
      expect((await user.get('/auth/me')).body.data.user.dailyReminders).toBe(false);
    });

    it('sends the daily digest once per day to users who asked for it', async () => {
      const user = await newUser(ctx);
      const silent = await newUser(ctx);
      await say(user, '⚙️ Sozlamalar');
      await tap(user, 'set:digest');
      // Run on a month's last day, the monthly report would take this digest's place.
      await user.patch('/users/me', { monthlyReport: false });
      await quickAdd(user, '30 ming tushlik');
      await quickAdd(silent, '30 ming tushlik');

      const digest = ctx.app.get(DailyDigestService);
      await digest.run();
      await digest.run();

      const digests = (client: ApiClient) =>
        ctx.telegram.messagesTo(tg(client).id).filter((m) => m.includes('🌙 Kunlik xulosa'));
      expect(digests(user)).toHaveLength(1);
      expect(digests(user)[0]).toContain('30 000 so‘m');
      expect(digests(silent)).toHaveLength(0);
    });

    it('does not call a day of transfers only an empty one', async () => {
      const user = await newUser(ctx);
      await say(user, '⚙️ Sozlamalar');
      await tap(user, 'set:digest');
      const from = await firstAccountId(user);
      const to = (await user.post('/accounts', { name: 'Humo', type: 'CARD', openingBalance: '0' })).body.data.id as string;
      await user.post('/transfers', { fromAccountId: from, toAccountId: to, amount: '100', date: today() });

      await ctx.app.get(DailyDigestService).run();

      const digest = ctx.telegram.messagesTo(tg(user).id).find((m) => m.includes('🌙 Kunlik xulosa')) ?? '';
      expect(digest).toContain('Umumiy balans');
      expect(digest).not.toContain('hech narsa yozilmadi');
    });
  });
  describe('in Russian', () => {
    const ru = BOT_TEXTS.ru;
    const names = (rows: Array<{ name: string }>) => rows.map((row) => row.name);
    const locale = async (client: ApiClient) => (await client.get('/auth/me')).body.data.user.locale as string;

    /** Labels of the newest reply keyboard (the menu under the input field) sent to the chat. */
    function menuLabels(client: ApiClient): string[] {
      const markup = ctx.telegram.calls
        .filter((c) => c.method === 'sendMessage' && Number(c.payload.chat_id) === tg(client).id)
        .map((c) => c.payload.reply_markup as { keyboard?: Array<Array<string | { text: string }>> } | undefined)
        .filter((m) => m?.keyboard)
        .at(-1);
      return (markup?.keyboard ?? []).flat().map((b) => (typeof b === 'string' ? b : b.text));
    }

    it('signs up from the Russian page in Russian, whatever the Telegram language', async () => {
      const user = await newUser(ctx, 'Иван', { page: 'ru', telegram: 'uz' });

      expect(await locale(user)).toBe('ru');
      const messages = ctx.telegram.messagesTo(tg(user).id);
      expect(messages).toEqual(expect.arrayContaining([LOGIN_TEXTS.ru.askContact, LOGIN_TEXTS.ru.registered]));
      expect(messages.some((m) => m.includes('Код для входа'))).toBe(true);

      const categories = names((await user.get('/categories')).body.data);
      expect(categories).toEqual(expect.arrayContaining(['Продукты', 'Транспорт', 'Жильё', 'Зарплата']));
      expect(categories).not.toContain('Oziq-ovqat');
      expect(names((await user.get('/accounts')).body.data)).toEqual(['Наличные']);
    });

    it('signs up someone who comes to the bot alone in the language of their Telegram', async () => {
      const tgUser = ctx.telegram.newUser('Пётр', 'ru');
      await ctx.deliver(textUpdate(tgUser, '/start'));
      await ctx.deliver(contactUpdate(tgUser, tgUser.id, `99890${String(tgUser.id).slice(-7)}`));

      expect(ctx.telegram.messagesTo(tgUser.id)).toEqual(
        expect.arrayContaining([LOGIN_TEXTS.ru.welcomeNew, LOGIN_TEXTS.ru.registeredPlain, ru.common.menuIntro]),
      );
      const stored = await ctx.prisma.user.findUnique({ where: { telegramId: BigInt(tgUser.id) }, include: { accounts: true } });
      expect(stored?.locale).toBe('ru');
      expect(names(stored?.accounts ?? [])).toEqual(['Наличные']);
    });

    it('takes Russian quick entries and answers in Russian', async () => {
      const user = await newUser(ctx, 'Иван', { page: 'ru' });

      await say(user, '45к такси');
      const card = lastText(user);
      expect(card).toContain('Расход');
      expect(card).toContain('45 000 сум');
      expect(card).toContain('Транспорт');
      await tap(user, button(user, /^d:[\w-]{8}:save$/));
      const [tx] = await transactions(user);
      expect(tx).toMatchObject({ type: 'EXPENSE', amount: '4500000', note: 'такси', category: { name: 'Транспорт' } });
      expect(lastText(user)).toContain('✅ Сохранено');
      expect(lastText(user)).not.toContain('so‘m');

      expect(await quickAdd(user, '+2 млн зарплата')).toMatchObject({ type: 'INCOME', amount: '200000000', category: { name: 'Зарплата' } });

      await say(user, ru.menu.balance);
      expect(lastText(user)).toContain(ru.reports.balanceTitle);
      expect(lastText(user)).toContain('Итого: <b>1 955 000 сум</b>');
    });

    it('switches the language in the settings, the menu with it, and hears the buttons of both', async () => {
      const user = await newUser(ctx);
      await say(user, BOT_TEXTS.uz.menu.settings);
      await tap(user, button(user, /^lang:ru$/));

      expect(await locale(user)).toBe('ru');
      expect(lastAnswer()).toBe(ru.settings.savedToast);
      const outputs = ctx.telegram.outputs(tg(user).id);
      expect(outputs.filter((o) => o.method === 'editMessageText').at(-1)?.text).toBe(ru.settings.text);
      expect(outputs.at(-1)?.text).toBe(ru.settings.languageChanged);
      expect(menuLabels(user)).toEqual(expect.arrayContaining([ru.menu.expense, ru.menu.settings]));
      expect(menuLabels(user)).not.toContain(BOT_TEXTS.uz.menu.settings);

      // A keyboard still showing Uzbek buttons keeps working, now answering in Russian.
      await say(user, BOT_TEXTS.uz.menu.balance);
      expect(lastText(user)).toContain(ru.reports.balanceTitle);

      await say(user, ru.menu.settings);
      await tap(user, 'lang:uz');
      expect(await locale(user)).toBe('uz');
      expect(menuLabels(user)).toContain(BOT_TEXTS.uz.menu.settings);
    });

    it("writes notifications in the owner's language", async () => {
      const user = await newUser(ctx, 'Иван', { page: 'ru' });
      await quickAdd(user, '+1 млн зарплата');
      await user.post('/budgets', {
        categoryId: await categoryId(user, 'Транспорт'),
        month: today().slice(0, 7),
        limitAmount: '10000000',
      });
      await quickAdd(user, '85 тыс такси');

      const warnings = (await user.get('/notifications')).body.data.filter((n: { type: string }) => n.type === 'BUDGET_WARNING');
      expect(warnings).toEqual([
        expect.objectContaining({ title: 'Бюджет почти исчерпан', body: 'Бюджет «Транспорт» израсходован на 85%.' }),
      ]);
    });
  });
});
