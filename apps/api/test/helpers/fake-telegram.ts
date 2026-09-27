import { Bot } from 'grammy';

export interface ApiCall {
  method: string;
  payload: Record<string, unknown>;
}

export interface FakeTgUser {
  id: number;
  first_name: string;
  username?: string;
}

let updateSeq = 1;
// Unique across test files and runs: Telegram ids are real identities in the database.
let tgUserSeq = 600_000_000 + Math.floor(Math.random() * 300_000_000);

/**
 * Stands in for the Telegram Bot API: every call the bot makes is recorded and answered
 * locally, so e2e tests can read the one-time codes the bot "sends".
 */
export class FakeTelegram {
  readonly calls: ApiCall[] = [];
  private messageId = 1;

  install(bot: Bot): void {
    bot.api.config.use(async (_prev, method, payload) => {
      const body = (payload ?? {}) as Record<string, unknown>;
      this.calls.push({ method, payload: body });
      return { ok: true, result: this.result(method, body) } as never;
    });
  }

  newUser(firstName = 'Test'): FakeTgUser {
    tgUserSeq += 1;
    return { id: tgUserSeq, first_name: firstName, username: `u${tgUserSeq}` };
  }

  messagesTo(chatId: number): string[] {
    return this.calls
      .filter((c) => c.method === 'sendMessage' && Number(c.payload.chat_id) === chatId)
      .map((c) => String(c.payload.text));
  }

  lastCode(chatId: number): string {
    const withCode = this.messagesTo(chatId).reverse().find((t) => /<code>\d{6}<\/code>/.test(t));
    const match = withCode ? /<code>(\d{6})<\/code>/.exec(withCode) : null;
    if (!match) throw new Error(`no code was sent to ${chatId}`);
    return match[1];
  }

  private result(method: string, payload: Record<string, unknown>): unknown {
    switch (method) {
      case 'getMe':
        return {
          id: 999_999,
          is_bot: true,
          first_name: 'FinTrack',
          username: 'fintrack_test_bot',
          can_join_groups: false,
          can_read_all_group_messages: false,
          supports_inline_queries: false,
          can_connect_to_business: false,
          has_main_web_app: false,
        };
      case 'sendMessage':
        return {
          message_id: this.messageId++,
          date: Math.floor(Date.now() / 1000),
          chat: { id: payload.chat_id, type: 'private' },
          text: payload.text,
        };
      default:
        return true;
    }
  }
}

function base(from: FakeTgUser) {
  return {
    message_id: updateSeq,
    date: Math.floor(Date.now() / 1000),
    chat: { id: from.id, type: 'private', first_name: from.first_name },
    from: { ...from, is_bot: false, language_code: 'uz' },
  };
}

export function textUpdate(from: FakeTgUser, text: string) {
  const command = text.startsWith('/') ? text.split(' ')[0] : null;
  return {
    update_id: updateSeq++,
    message: {
      ...base(from),
      text,
      ...(command ? { entities: [{ type: 'bot_command', offset: 0, length: command.length }] } : {}),
    },
  };
}

export function contactUpdate(from: FakeTgUser, contactUserId: number, phone: string) {
  return {
    update_id: updateSeq++,
    message: {
      ...base(from),
      contact: { phone_number: phone, first_name: from.first_name, user_id: contactUserId },
    },
  };
}

export function callbackUpdate(from: FakeTgUser, data: string) {
  return {
    update_id: updateSeq++,
    callback_query: {
      id: String(updateSeq),
      from: { ...from, is_bot: false },
      chat_instance: 'ci',
      data,
      message: { ...base(from), text: 'code' },
    },
  };
}
