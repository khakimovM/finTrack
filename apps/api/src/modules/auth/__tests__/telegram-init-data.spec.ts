import { createHmac } from 'crypto';
import { validateInitData } from '../telegram-init-data';

const BOT_TOKEN = '123456789:AAFakeTokenForUnitTestsOnly_abcdefghijk';
const NOW = 1_790_000_000;
const DAY = 24 * 3600;

/** Signs fields the way Telegram does; `signatureInString` mirrors the docs' other reading. */
function sign(fields: Record<string, string>, token = BOT_TOKEN, signatureInString = true): string {
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const lines = Object.entries(fields)
    .filter(([key]) => signatureInString || key !== 'signature')
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const hash = createHmac('sha256', secret).update(lines).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const user = JSON.stringify({ id: 777000111, first_name: 'Aziz', username: 'aziz', language_code: 'uz' });
const fields = (over: Record<string, string> = {}) => ({
  query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
  user,
  auth_date: String(NOW - 60),
  ...over,
});

describe('validateInitData', () => {
  it('accepts data signed with the bot token and returns the Telegram user', () => {
    const result = validateInitData(sign(fields()), BOT_TOKEN, DAY, NOW);
    expect(result).toMatchObject({
      ok: true,
      authDate: NOW - 60,
      user: { id: 777000111, firstName: 'Aziz', username: 'aziz', languageCode: 'uz' },
    });
  });

  it.each([
    ['part of the signed string', true],
    ['left out of the signed string', false],
  ])('accepts a signature field that is %s', (_label, inString) => {
    const initData = sign(fields({ signature: 'ed25519-signature-base64url' }), BOT_TOKEN, inString);
    expect(validateInitData(initData, BOT_TOKEN, DAY, NOW).ok).toBe(true);
  });

  it('rejects data signed with another bot token', () => {
    const forged = sign(fields(), '987654321:AAAnotherBotTokenThatIsNotOurs_abcdefgh');
    expect(validateInitData(forged, BOT_TOKEN, DAY, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects any tampered field', () => {
    const initData = new URLSearchParams(sign(fields()));
    initData.set('user', JSON.stringify({ id: 1, first_name: 'Attacker' }));
    expect(validateInitData(initData.toString(), BOT_TOKEN, DAY, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  it.each([
    ['older than the allowed age', String(NOW - DAY - 1)],
    ['from the future', String(NOW + 3600)],
  ])('reports data %s as expired', (_label, authDate) => {
    expect(validateInitData(sign(fields({ auth_date: authDate })), BOT_TOKEN, DAY, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it.each([
    ['no hash', 'user=%7B%7D&auth_date=1'],
    ['a malformed hash', 'user=%7B%7D&auth_date=1&hash=xyz'],
    ['an empty string', ''],
  ])('rejects %s', (_label, initData) => {
    expect(validateInitData(initData, BOT_TOKEN, DAY, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  it.each([
    ['a bot account', JSON.stringify({ id: 5, first_name: 'Bot', is_bot: true })],
    ['a non-numeric id', JSON.stringify({ id: '5', first_name: 'X' })],
    ['a broken user field', '{not json'],
  ])('rejects %s even when correctly signed', (_label, badUser) => {
    expect(validateInitData(sign(fields({ user: badUser })), BOT_TOKEN, DAY, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects signed data without a user (keyboard-button launches)', () => {
    const noUser: Record<string, string> = { auth_date: String(NOW - 5), query_id: 'q' };
    expect(validateInitData(sign(noUser), BOT_TOKEN, DAY, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });
});
