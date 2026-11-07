import type { MessageOrigin } from 'grammy/types';
import { parseCardMessage } from '../cards/card-message.parser';
import { cardNetworkOf, operationFingerprint, operationInstant } from '../cards/card-sources';
import { ImportView, OperationView, Screen, itemScreen, listScreen, mappingScreen, summaryScreen } from '../cards/card-ui';
import { UZCARD } from './fixtures/card-messages';

const fromBot = (id: number, username?: string): MessageOrigin => ({
  type: 'user',
  date: 1_762_000_000,
  sender_user: { id, is_bot: true, first_name: 'Bot', ...(username ? { username } : {}) },
});

describe('card notification sources', () => {
  it('trusts forwards whose origin, as Telegram recorded it, is a card bot', () => {
    expect(cardNetworkOf(fromBot(915326936), UZCARD.purchase)).toBe('UZCARD');
    expect(cardNetworkOf(fromBot(42, 'HUMOcardbot'), 'anything')).toBe('HUMO');
    expect(cardNetworkOf(fromBot(43), '💳 HUMOCARD *3333')).toBe('HUMO');
    expect(cardNetworkOf(fromBot(44), UZCARD.purchase)).toBe('UZCARD');
  });

  it('ignores the same text from a person, a hidden sender, or with no forward at all', () => {
    const person: MessageOrigin = { type: 'user', date: 1, sender_user: { id: 915326936, is_bot: false, first_name: 'X' } };
    const hidden: MessageOrigin = { type: 'hidden_user', date: 1, sender_user_name: 'CardXabar' };
    expect(cardNetworkOf(person, UZCARD.purchase)).toBeNull();
    expect(cardNetworkOf(hidden, UZCARD.purchase)).toBeNull();
    expect(cardNetworkOf(undefined, UZCARD.purchase)).toBeNull();
    expect(cardNetworkOf(fromBot(45), 'Hello')).toBeNull();
  });

  it('fingerprints a notification the same way every time, and two purchases apart by their balance', () => {
    const parsed = parseCardMessage(UZCARD.purchase, 'UZCARD');
    if (parsed.kind !== 'operation') throw new Error('fixture is an operation');
    const op = parsed.operation;
    expect(operationFingerprint(op)).toBe(operationFingerprint({ ...op }));
    expect(operationFingerprint(op)).not.toBe(operationFingerprint({ ...op, balanceAfter: 0n }));
    expect(operationFingerprint(op)).toMatch(/^[0-9a-f]{64}$/);
    expect(operationInstant(op).toISOString()).toBe('2026-10-31T16:14:00.000Z');
  });
});

const ID = 'Ab3dE5fG';
const UUID = '0b7d4f0e-9f1c-4c39-9a51-3f2a7d1e8c42';

function operation(seq: number, overrides: Partial<OperationView> = {}): OperationView {
  return {
    seq,
    direction: 'DEBIT',
    amount: 1_845_000n,
    merchant: 'ANGLESEY FOOD',
    card: 'Uzcard •1111',
    when: '31.10.2026 21:14',
    kind: 'SHOP',
    reversal: false,
    status: 'PENDING',
    resolution: 'EXPENSE',
    category: '🍔 Oziq-ovqat',
    counterAccount: null,
    partner: null,
    debtPerson: null,
    ...overrides,
  };
}

function view(operations: OperationView[], overrides: Partial<ImportView> = {}): ImportView {
  return {
    id: ID,
    locale: 'uz',
    period: '31-oktabr – 5-noyabr',
    cards: [{ label: 'Uzcard •1111', account: '💳 Uzcard' }],
    operations,
    ignored: 3,
    repeated: 0,
    balances: null,
    ...overrides,
  };
}

const buttons = (screen: Screen) => screen.keyboard.inline_keyboard.flat().map((b) => ('callback_data' in b ? b.callback_data : ''));

describe('card import screens', () => {
  it('groups the summary and offers saving what is decided and reviewing the rest', () => {
    const screen = summaryScreen(
      view([
        operation(1),
        operation(2, { resolution: null, kind: 'P2P', merchant: 'CLICK P2P', category: null }),
        operation(3, { resolution: 'DUPLICATE' }),
      ]),
    );
    expect(screen.text).toContain('<b>✅ Yozishga tayyor: 1</b>');
    expect(screen.text).toContain('<b>❓ Ko‘rib chiqing: 1</b>');
    expect(screen.text).toContain('#1 ➖18 450 · 🍔 Oziq-ovqat · ANGLESEY FOOD · 31.10');
    expect(screen.text).toContain('3 ta xabar operatsiya emas');
    expect(buttons(screen)).toEqual([`ci:${ID}:save`, `ci:${ID}:rev`, `ci:${ID}:list:1`, `ci:${ID}:cancel`]);
  });

  it('offers undo and the bank balance check once something was saved', () => {
    const screen = summaryScreen(
      view([operation(1, { status: 'SAVED' })], { balances: [{ card: '💳 Uzcard', bank: 35_241_840n, ledger: 47_000_000n }] }),
    );
    expect(screen.text).toContain('⚠️ 💳 Uzcard: bankda 352 418,40 so‘m, FinTrack’da 470 000 so‘m');
    expect(buttons(screen)).toEqual([`ci:${ID}:bal`, `ci:${ID}:undo`]);
  });

  it('keeps a long import within one Telegram message', () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      operation(i + 1, { resolution: i % 3 === 0 ? null : 'EXPENSE', merchant: `VERY LONG MERCHANT NAME NUMBER ${i} LLC` }),
    );
    const screen = summaryScreen(view(many));
    expect(screen.text.length).toBeLessThanOrEqual(4096);
    expect(screen.text).toContain('… yana');
  });

  it('escapes what came from the bank', () => {
    const screen = summaryScreen(view([operation(1, { merchant: '<b>EVIL</b> & CO' })]));
    expect(screen.text).toContain('&lt;b&gt;EVIL&lt;/b&gt; &amp; CO');
  });

  it('keeps every button’s callback data within Telegram’s 64 bytes', () => {
    const ops = [
      operation(9999, { resolution: null, kind: 'P2P' }),
      operation(9998, { resolution: null, partner: { seq: 9997, card: 'Humo •3333', amount: 2_000_000n } }),
    ];
    const screens = [
      summaryScreen(view(ops)),
      itemScreen(view(ops), ops[0], 'r', 1),
      itemScreen(view(ops), ops[1], 'e', 99),
      listScreen(view(ops), 1),
      mappingScreen(ID, 'ru', { network: 'HUMO', last4: '3333' }, [{ id: UUID, label: '💳 Karta' }]),
    ];
    const all = screens.flatMap(buttons);
    all.push(`ci:${ID}:r9999:c:${UUID}`, `ci:${ID}:e9999:f:${UUID}`);
    for (const data of all) expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
  });

  it('asks about a suggested transfer as a pair, and about anything else by what it could be', () => {
    const pair = operation(4, { resolution: null, kind: 'P2P', partner: { seq: 5, card: 'Humo •3333', amount: 4_000_000n }, amount: 4_044_000n });
    const pairScreen = itemScreen(view([pair]), pair, 'r', 1);
    expect(pairScreen.text).toContain('Uzcard •1111 → Humo •3333 (komissiya 440 so‘m, u chiqimga yoziladi)');
    expect(buttons(pairScreen)).toEqual([`ci:${ID}:r4:ok`, `ci:${ID}:r4:u`, `ci:${ID}:sum`, `ci:${ID}:r4:n`]);

    const credit = operation(6, { direction: 'CREDIT', resolution: null, kind: 'P2P' });
    const creditScreen = itemScreen(view([credit]), credit, 'e', 2);
    expect(creditScreen.text).toContain('Kartadan kartaga');
    expect(buttons(creditScreen)).toEqual([`ci:${ID}:e6:i`, `ci:${ID}:e6:d`, `ci:${ID}:e6:t`, `ci:${ID}:e6:s`, `ci:${ID}:list:2`]);
  });
});
