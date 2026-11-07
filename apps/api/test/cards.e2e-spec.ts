import { addDays, formatIsoDate, parseIsoDate } from '@fintrack/shared';
import { createTestApp, TestApp } from './helpers/app';
import { ApiClient, categoryId, firstAccountId, newUser, today } from './helpers/api-client';
import { FakeTgUser, callbackUpdate, forwardUpdate, textUpdate } from './helpers/fake-telegram';
import { CardIntakeService } from '../src/modules/telegram/cards/card-intake.service';
import { MerchantClassifier } from '../src/modules/assistant/merchant-classifier.service';

const CARD_XABAR = { id: 915326936, isBot: true };
const HUMO_BOT = { id: 777_000_111, isBot: true, username: 'HUMOcardbot' };

/** What the fake AI answers (merchant → category name), and what it was asked. */
const aiAnswers = new Map<string, string>();
const aiAsked: string[][] = [];
const fakeClassifier = {
  enabled: true,
  classify: async (_userId: string, merchants: string[]) => {
    aiAsked.push(merchants);
    return new Map(merchants.flatMap((m): Array<[string, string]> => (aiAnswers.has(m) ? [[m, aiAnswers.get(m) ?? '']] : [])));
  },
};

const daysAgo = (n: number) => formatIsoDate(addDays(parseIsoDate(today()), -n));

/** A CardXabar notification exactly as the bot lays it out. */
function uzcard(card: string, sign: '-' | '+', amount: string, merchant: string, day: string, time: string, balance: string, label?: string) {
  const [yy, mm, dd] = day.split('-');
  return [
    `${sign === '-' ? '🔴' : '🟢'} ${label ?? (sign === '-' ? 'Pokupka' : 'Perevod na kartu')}`,
    `${sign === '-' ? '➖' : '➕'} ${amount} UZS`,
    `💳 ***${card}`,
    `📍 ${merchant}, TASHKENT`,
    `🕓 ${dd}.${mm}.${yy.slice(2)} ${time}`,
    `💵 ${balance} UZS`,
  ].join('\n');
}

function humo(card: string, sign: '-' | '+', amount: string, merchant: string, day: string, time: string, balance: string) {
  const [yy, mm, dd] = day.split('-');
  return [
    sign === '-' ? "💸 To'lov" : "🎉 To'ldirish",
    `${sign === '-' ? '➖' : '➕'} ${amount} UZS`,
    `📍 ${merchant}`,
    `💳 HUMOCARD *${card}`,
    `🕓 ${time} ${dd}.${mm}.${yy}`,
    `💰 ${balance} UZS`,
  ].join('\n');
}

describe('Card import by forwarding (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp((b) => b.overrideProvider(MerchantClassifier).useValue(fakeClassifier));
  });

  afterAll(async () => {
    await ctx.close();
  });

  const tg = (client: ApiClient): FakeTgUser => {
    if (!client.telegramUser) throw new Error('client has no Telegram identity');
    return client.telegramUser;
  };
  const chat = (client: ApiClient) => tg(client).id;
  const screen = (client: ApiClient) => ctx.telegram.last(chat(client)).text;
  const tap = (client: ApiClient, data: string) => ctx.deliver(callbackUpdate(tg(client), data));
  const say = (client: ApiClient, text: string) => ctx.deliver(textUpdate(tg(client), text));
  const flush = (client: ApiClient) => ctx.app.get(CardIntakeService).flush(client.userId);

  async function forward(client: ApiClient, origin: { id: number; isBot: boolean; username?: string }, ...texts: string[]) {
    for (const text of texts) await ctx.deliver(forwardUpdate(tg(client), text, origin));
  }

  /** Forwards, waits out the burst, and gives every new card a new account. Returns the import id. */
  async function importBurst(client: ApiClient, ...texts: string[]): Promise<string> {
    await forward(client, CARD_XABAR, ...texts);
    const id = await flush(client);
    if (!id) throw new Error('nothing was imported');
    for (let i = 0; i < 3 && ctx.telegram.last(chat(client)).buttons.some((b) => b.startsWith('cm:')); i++) {
      await tap(client, ctx.telegram.button(chat(client), /^cm:[\w-]{8}:[UH]\d{4}:new$/));
    }
    return id;
  }

  const cardRows = (client: ApiClient) =>
    ctx.prisma.transaction.findMany({ where: { userId: client.userId, source: 'CARD', deletedAt: null }, orderBy: [{ amount: 'asc' }, { type: 'asc' }] });

  it('turns a forwarded burst into one list: the card’s account first, then what is clear, then questions', async () => {
    const user = await newUser(ctx);
    const day = daysAgo(2);
    const before = ctx.telegram.outputs(chat(user)).length;
    await forward(
      user,
      CARD_XABAR,
      uzcard('1111', '-', '40 440.00', 'CLICK P2P U2HEW', day, '10:07', '370 868.40', 'Platezh'),
      uzcard('1111', '-', '18 450.00', 'ANGLESEY FOOD', day, '10:28', '352 418.40'),
      uzcard('1111', '-', '3 000.00', 'OOO ATTO TOLOV', day, '11:10', '349 418.40'),
      'NEDOSTATOCHNO SREDSTV 5614***1111 05.11.26 19:05  POS purchase 0.00 UZS',
    );
    expect(ctx.telegram.outputs(chat(user))).toHaveLength(before);

    const id = await flush(user);
    expect(id).toMatch(/^[\w-]{8}$/);
    expect(screen(user)).toContain('<b>Uzcard •1111</b> — FinTrack’dagi qaysi hisobingiz?');
    await tap(user, ctx.telegram.button(chat(user), /^cm:[\w-]{8}:U1111:new$/));

    const summary = screen(user);
    expect(summary).toContain('Kartadan 3 ta operatsiya');
    expect(summary).toContain('<b>✅ Yozishga tayyor: 2</b>');
    expect(summary).toContain('🍔 Oziq-ovqat · ANGLESEY FOOD');
    expect(summary).toContain('🚗 Transport · OOO ATTO TOLOV');
    expect(summary).toContain('<b>❓ Ko‘rib chiqing: 1</b>');
    expect(summary).toContain('1 ta xabar operatsiya emas');
    expect(await cardRows(user)).toHaveLength(0);

    await tap(user, `ci:${id}:rev`);
    expect(screen(user)).toContain('❓ <b>1/1</b>');
    expect(screen(user)).toContain('CLICK P2P U2HEW');
    await tap(user, `ci:${id}:r1:x`);
    await tap(user, `ci:${id}:r1:c:${await categoryId(user, 'Ko‘ngilochar')}`);
    expect(screen(user)).toContain('<b>✅ Yozishga tayyor: 3</b>');

    await tap(user, `ci:${id}:save`);
    expect(screen(user)).toContain('3 ta operatsiya yozildi');
    expect(screen(user)).toContain('✓ 💳 Uzcard •1111: 349 418,40 so‘m');
    const rows = await cardRows(user);
    expect(rows.map((r) => [r.type, r.amount, formatIsoDate(r.date)])).toEqual([
      ['EXPENSE', 300_000n, day],
      ['EXPENSE', 1_845_000n, day],
      ['EXPENSE', 4_044_000n, day],
    ]);
    const accounts = (await user.get('/accounts')).body.data as Array<{ name: string; type: string; balance: string }>;
    expect(accounts.find((a) => a.name === 'Uzcard •1111')).toMatchObject({ type: 'CARD', balance: '34941840' });
  });

  it('knows a message it has seen, and after an undo takes it again', async () => {
    const user = await newUser(ctx);
    const purchase = uzcard('2222', '-', '18 450.00', 'ANGLESEY FOOD', daysAgo(1), '09:00', '100 000.00');
    const id = await importBurst(user, purchase);
    await tap(user, `ci:${id}:save`);
    expect(await cardRows(user)).toHaveLength(1);

    await forward(user, CARD_XABAR, purchase);
    await flush(user);
    expect(screen(user)).toContain('Yangi operatsiya yo‘q');
    expect(screen(user)).toContain('1 tasi avval kiritilgan edi');

    await tap(user, `ci:${id}:undo`);
    expect(screen(user)).toContain('Import bekor qilindi');
    expect(await cardRows(user)).toHaveLength(0);

    await forward(user, CARD_XABAR, purchase);
    const again = await flush(user);
    expect(screen(user)).toContain('<b>✅ Yozishga tayyor: 1</b>');
    expect(again).not.toBe(id);
  });

  it('takes notifications only from a card bot', async () => {
    const user = await newUser(ctx);
    const text = uzcard('3333', '-', '18 450.00', 'ANGLESEY FOOD', daysAgo(1), '09:00', '100 000.00');
    await forward(user, { id: 915326936, isBot: false }, text);
    expect(screen(user)).toContain('<b>forward</b> qiling');
    await say(user, text);
    expect(screen(user)).toContain('<b>forward</b> qiling');
    expect(await flush(user)).toBeNull();
    expect(await ctx.prisma.cardOperation.count({ where: { userId: user.userId } })).toBe(0);
  });

  it('pairs a transfer between own cards, asks once where its fee goes, and remembers', async () => {
    const user = await newUser(ctx);
    const day = daysAgo(1);
    await forward(user, CARD_XABAR, uzcard('4444', '-', '40 440.00', 'UB P2P UZCARD2HUMO', day, '12:00', '100 000.00', 'Platezh'));
    await forward(user, HUMO_BOT, humo('5555', '+', '40.000,00', 'UB P2P UZCARD2HUMO', day, '12:01', '40.000,00'));
    const id = await flush(user);
    for (const card of ['H5555', 'U4444']) await tap(user, ctx.telegram.button(chat(user), new RegExp(`^cm:[\\w-]{8}:${card}:new$`)));
    expect(screen(user)).toContain('<b>❓ Ko‘rib chiqing: 2</b>');

    await tap(user, `ci:${id}:rev`);
    expect(screen(user)).toContain('Uzcard •4444 → Humo •5555 (komissiya 440 so‘m');
    await tap(user, `ci:${id}:r1:ok`);
    const fees = await categoryId(user, 'Kommunal');
    await tap(user, `ci:${id}:r1:f:${fees}`);
    expect(screen(user)).toContain('<b>🔁 O‘z hisoblaringiz orasida: 2</b>');
    await tap(user, `ci:${id}:save`);

    const rows = await cardRows(user);
    expect(rows.map((r) => [r.type, r.amount])).toEqual([
      ['EXPENSE', 44_000n],
      ['TRANSFER_IN', 4_000_000n],
      ['TRANSFER_OUT', 4_000_000n],
    ]);
    expect(rows[0].categoryId).toBe(fees);
    expect(screen(user)).toContain('✓ 💳 Uzcard •4444: 100 000 so‘m');
    expect(screen(user)).toContain('✓ 💳 Humo •5555: 40 000 so‘m');

    await forward(user, CARD_XABAR, uzcard('4444', '-', '10 110.00', 'UB P2P UZCARD2HUMO', day, '15:00', '89 890.00', 'Platezh'));
    await forward(user, HUMO_BOT, humo('5555', '+', '10.000,00', 'UB P2P UZCARD2HUMO', day, '15:00', '50.000,00'));
    await flush(user);
    expect(screen(user)).toContain('<b>🔁 O‘z hisoblaringiz orasida: 2</b>');
    expect(screen(user)).not.toContain('❓ Ko‘rib chiqing');
  });

  it('cancels a refunded purchase, links one typed in by hand, and books a loan', async () => {
    const user = await newUser(ctx);
    const day = daysAgo(1);
    const typed = await user.post('/transactions', {
      type: 'EXPENSE',
      accountId: await firstAccountId(user),
      amount: '1845000',
      categoryId: await categoryId(user, 'Oziq-ovqat'),
      date: day,
      note: 'korzinka',
    });
    expect(typed.status).toBe(201);

    const id = await importBurst(
      user,
      uzcard('6666', '-', '96 500.00', 'OOO UZUM', day, '09:00', '903 500.00', 'E-Com oplata'),
      uzcard('6666', '+', '96 500.00', 'OOO UZUM', day, '09:01', '1 000 000.00', 'OTMENA E-Com oplata'),
      uzcard('6666', '-', '18 450.00', 'ANGLESEY FOOD', day, '10:00', '981 550.00'),
      uzcard('6666', '-', '50 000.00', 'CLICK P2P', day, '11:00', '931 550.00', 'Platezh'),
    );
    expect(screen(user)).toContain('<b>↩️ Bekor qilingan xaridlar (pul qaytgan): 2</b>');
    expect(screen(user)).toContain('<b>♻️ Qo‘lda kiritilgan, qayta yozilmaydi: 1</b>');

    await tap(user, `ci:${id}:r4:d`);
    expect(screen(user)).toContain('Kimga qarz berdingiz?');
    await say(user, 'Ali');
    expect(screen(user)).toContain('<b>🤝 Qarzlar: 1</b>');
    await tap(user, `ci:${id}:save`);

    expect((await cardRows(user)).map((r) => [r.type, r.amount])).toEqual([['LOAN_GIVEN', 5_000_000n]]);
    const debt = await ctx.prisma.debt.findFirst({ where: { userId: user.userId, deletedAt: null } });
    expect(debt).toMatchObject({ personName: 'Ali', direction: 'I_LENT', amount: 5_000_000n });
    const statuses = await ctx.prisma.cardOperation.findMany({ where: { userId: user.userId }, orderBy: { seq: 'asc' }, select: { status: true } });
    expect(statuses.map((s) => s.status)).toEqual(['SKIPPED', 'SKIPPED', 'LINKED', 'SAVED']);
  });

  it('records card spending in strict mode too, and lines the balance up with the bank on request', async () => {
    const user = await newUser(ctx);
    expect((await user.patch('/users/me', { strictMode: true })).status).toBe(200);
    await forward(user, CARD_XABAR, uzcard('7777', '-', '18 450.00', 'ANGLESEY FOOD', daysAgo(1), '09:00', '81 550.00'));
    const id = await flush(user);
    const cash = await firstAccountId(user);
    await tap(user, `${ctx.telegram.button(chat(user), /^cm:[\w-]{8}:U7777:/).split(':').slice(0, 3).join(':')}:${cash}`);
    await tap(user, `ci:${id}:save`);
    expect(await cardRows(user)).toHaveLength(1);
    expect(screen(user)).toContain('⚠️');

    await tap(user, `ci:${id}:bal`);
    expect(ctx.telegram.callbackAnswers().pop()).toContain('1 ta hisob balansi bankdagiga tenglandi');
    const accounts = (await user.get('/accounts')).body.data as Array<{ id: string; balance: string }>;
    expect(accounts.find((a) => a.id === cash)?.balance).toBe('8155000');
  });

  it('asks the AI only about shops nothing else knows, and keeps its answer once saved', async () => {
    const user = await newUser(ctx);
    aiAnswers.set('XALQ RETAIL MCHJ KHK', 'Oziq-ovqat');
    const id = await importBurst(
      user,
      uzcard('8888', '-', '15 000.00', 'XALQ RETAIL MCHJ KHK', daysAgo(2), '09:00', '85 000.00'),
      uzcard('8888', '-', '3 000.00', 'OOO ATTO TOLOV', daysAgo(2), '10:00', '82 000.00'),
    );
    expect(aiAsked.pop()).toEqual(['XALQ RETAIL MCHJ KHK']);
    expect(screen(user)).toContain('🍔 Oziq-ovqat · XALQ RETAIL MCHJ KHK');
    await tap(user, `ci:${id}:save`);

    const asked = aiAsked.length;
    await importBurst(user, uzcard('8888', '-', '9 000.00', 'XALQ RETAIL MCHJ KHK', daysAgo(1), '09:00', '73 000.00'));
    expect(aiAsked).toHaveLength(asked);
    expect(screen(user)).toContain('🍔 Oziq-ovqat · XALQ RETAIL MCHJ KHK');
  });

  it('never lets another account see or save someone’s import', async () => {
    const owner = await newUser(ctx);
    const stranger = await newUser(ctx);
    await forward(owner, CARD_XABAR, uzcard('9999', '-', '18 450.00', 'ANGLESEY FOOD', daysAgo(1), '09:00', '100 000.00'));
    const id = await flush(owner);

    await tap(stranger, `cm:${id}:U9999:new`);
    await tap(stranger, `ci:${id}:save`);
    expect(ctx.telegram.callbackAnswers().slice(-2)).toEqual(['Bu ro‘yxat endi yo‘q.', 'Bu ro‘yxat endi yo‘q.']);
    expect(await ctx.prisma.account.count({ where: { userId: stranger.userId, name: { startsWith: 'Uzcard' } } })).toBe(0);
    expect(await ctx.prisma.cardOperation.count({ where: { userId: owner.userId, status: 'PENDING' } })).toBe(1);
  });

  it('speaks Russian to a Russian account', async () => {
    const user = await newUser(ctx, 'Ivan', { page: 'ru' });
    await importBurst(user, uzcard('1212', '-', '18 450.00', 'ANGLESEY FOOD', daysAgo(1), '09:00', '100 000.00'));
    expect(screen(user)).toContain('Операций по карте: 1');
    expect(screen(user)).toContain('<b>✅ Готово к записи: 1</b>');
  });
});
