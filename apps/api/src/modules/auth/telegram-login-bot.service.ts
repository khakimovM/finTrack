import { Injectable } from '@nestjs/common';
import { Prisma, TelegramLoginRequest, User } from '@prisma/client';
import { TelegramLoginRepository } from './telegram-login.repository';
import { LoginCodeService } from './login-code.service';
import { AuthRepository } from './auth.repository';
import { SessionStateService } from './session-state.service';
import { hashNonce } from './telegram-login.service';
import { LOGIN_TEXT } from './telegram-login.messages';
import { TelegramBotService } from '../../infra/telegram/telegram-bot.service';

export interface TelegramFrom {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}

export interface TelegramContact {
  /** Present only when the contact is a Telegram user; must equal the sender for self-shares. */
  userId?: number;
  phoneNumber: string;
}

const CONTACT_KEYBOARD = {
  keyboard: [[{ text: LOGIN_TEXT.shareContactButton, request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

function displayName(from: TelegramFrom): string {
  const name = [from.firstName, from.lastName].filter(Boolean).join(' ').trim();
  return (name.length >= 2 ? name : 'Foydalanuvchi').slice(0, 100);
}

function localeFrom(languageCode?: string): string {
  return languageCode === 'ru' || languageCode === 'en' ? languageCode : 'uz';
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  return `+${digits}`;
}

/** The bot's side of sign-in, registration and account linking. */
@Injectable()
export class TelegramLoginBotService {
  constructor(
    private readonly repository: TelegramLoginRepository,
    private readonly codes: LoginCodeService,
    private readonly authRepository: AuthRepository,
    private readonly sessions: SessionStateService,
    private readonly telegram: TelegramBotService,
  ) {}

  /** `/start login_<nonce>` or `/start link_<nonce>`. Returns false for other payloads. */
  async handleStartPayload(payload: string, from: TelegramFrom): Promise<boolean> {
    const match = /^(login|link)_([A-Za-z0-9_-]{16,64})$/.exec(payload);
    if (!match) return false;

    const request = await this.repository.findByNonceHash(hashNonce(match[2]));
    const telegramId = BigInt(from.id);
    if (!request || request.purpose !== (match[1] === 'login' ? 'LOGIN' : 'LINK')) {
      await this.telegram.send(telegramId, LOGIN_TEXT.expired, { html: true });
      return true;
    }
    if (request.status !== 'PENDING' || request.expiresAt < new Date()) {
      const text = request.status === 'CONSUMED' ? LOGIN_TEXT.alreadyUsed : LOGIN_TEXT.expired;
      await this.telegram.send(telegramId, text, { html: true });
      return true;
    }

    if (request.purpose === 'LINK') {
      await this.completeLink(request, from);
      return true;
    }

    const user = await this.authRepository.findUserByTelegramId(telegramId);
    if (user) {
      await this.authRepository.touchTelegramProfile(user.id, from.username ?? null);
      await this.codes.issue(request, telegramId, user.id);
      return true;
    }

    // Unknown Telegram user: register first, then the code is sent after the contact arrives.
    await this.repository.update(request.id, { status: 'AWAITING_CONTACT', telegramId });
    await this.telegram.send(telegramId, LOGIN_TEXT.askContact, { html: true, replyMarkup: CONTACT_KEYBOARD });
    return true;
  }

  /** Plain `/start`: existing users are greeted; new users are asked to register. */
  async handlePlainStart(from: TelegramFrom): Promise<User | null> {
    const user = await this.authRepository.findUserByTelegramId(BigInt(from.id));
    if (user) {
      await this.authRepository.touchTelegramProfile(user.id, from.username ?? null);
      return user;
    }
    await this.telegram.send(BigInt(from.id), LOGIN_TEXT.welcomeNew, { html: true, replyMarkup: CONTACT_KEYBOARD });
    return null;
  }

  /**
   * A shared contact registers the sender. Only a contact about the sender themselves counts:
   * forwarding someone else's contact card must never create or unlock an account.
   */
  async handleContact(from: TelegramFrom, contact: TelegramContact): Promise<void> {
    const telegramId = BigInt(from.id);
    if (contact.userId !== from.id) {
      await this.telegram.send(telegramId, LOGIN_TEXT.contactNotYours, { html: true, replyMarkup: CONTACT_KEYBOARD });
      return;
    }

    let user = await this.authRepository.findUserByTelegramId(telegramId);
    if (!user) {
      const phone = normalizePhone(contact.phoneNumber);
      try {
        user = await this.authRepository.createTelegramUser({
          name: displayName(from),
          telegramId,
          telegramUsername: from.username ?? null,
          phone: (await this.authRepository.isPhoneTaken(phone)) ? null : phone,
          locale: localeFrom(from.languageCode),
        });
      } catch (err) {
        // A double tap on "share contact" races two registrations; the unique key keeps one.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
        user = await this.authRepository.findUserByTelegramId(telegramId);
        if (!user) throw err;
      }
    }

    const pending = await this.repository.findAwaitingContact(telegramId);
    await this.telegram.send(telegramId, LOGIN_TEXT.registered, {
      html: true,
      replyMarkup: { remove_keyboard: true },
    });
    if (pending) {
      await this.codes.issue(pending, telegramId, user.id);
    }
  }

  /** "Bu men emasman" under a code: kills the request so the code can no longer be redeemed. */
  async handleCancel(requestId: string, fromId: number): Promise<void> {
    const request = await this.repository.findById(requestId);
    if (!request || request.telegramId !== BigInt(fromId)) return;
    if (await this.repository.transition(request.id, ['PENDING', 'AWAITING_CONTACT', 'CODE_SENT'], 'CANCELLED')) {
      await this.telegram.send(BigInt(fromId), LOGIN_TEXT.cancelled, { html: true });
    }
  }

  private async completeLink(request: TelegramLoginRequest, from: TelegramFrom): Promise<void> {
    const telegramId = BigInt(from.id);
    const owner = await this.authRepository.findUserByTelegramId(telegramId);
    if (!request.userId || (owner && owner.id !== request.userId)) {
      await this.repository.transition(request.id, ['PENDING'], 'CANCELLED');
      await this.telegram.send(telegramId, LOGIN_TEXT.linkConflict, { html: true });
      return;
    }

    await this.authRepository.linkTelegram(request.userId, telegramId, from.username ?? null);
    await this.repository.update(request.id, { status: 'CONSUMED', telegramId, consumedAt: new Date() });
    await this.sessions.forgetUser(request.userId);
    await this.telegram.send(telegramId, LOGIN_TEXT.linked, { html: true });
  }
}
