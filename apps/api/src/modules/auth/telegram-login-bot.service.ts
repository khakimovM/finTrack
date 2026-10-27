import { Injectable } from '@nestjs/common';
import { Prisma, TelegramLoginRequest, User } from '@prisma/client';
import { TelegramLoginRepository } from './telegram-login.repository';
import { LoginCodeService } from './login-code.service';
import { AuthRepository } from './auth.repository';
import { SessionStateService } from './session-state.service';
import { START_PREFIX, hashNonce } from './telegram-login.service';
import { toAppLocale } from '@fintrack/shared';
import { ADMIN_LOGIN_TEXT, LoginTexts, loginText } from './telegram-login.messages';
import { TelegramBotService } from '../../infra/telegram/telegram-bot.service';
import { AdminAccessService } from '../admin/core/admin-access.service';
import { AdminAuditService } from '../admin/core/admin-audit.service';

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

function contactKeyboard(texts: LoginTexts) {
  return {
    keyboard: [[{ text: texts.shareContactButton, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function displayName(from: TelegramFrom): string {
  const name = [from.firstName, from.lastName].filter(Boolean).join(' ').trim();
  return (name.length >= 2 ? name : 'Foydalanuvchi').slice(0, 100);
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
    private readonly adminAccess: AdminAccessService,
    private readonly audit: AdminAuditService,
  ) {}

  /** `/start login_<nonce>`, `link_<nonce>` or `admin_<nonce>`. Returns false for other payloads. */
  async handleStartPayload(payload: string, from: TelegramFrom): Promise<boolean> {
    const match = /^(login|link|admin)_([A-Za-z0-9_-]{16,64})$/.exec(payload);
    if (!match) return false;

    const request = await this.repository.findByNonceHash(hashNonce(match[2]));
    const telegramId = BigInt(from.id);
    const user = await this.authRepository.findUserByTelegramId(telegramId);
    // The account's language; a newcomer gets the language of the page they came from.
    const texts = loginText(user?.locale ?? request?.locale ?? from.languageCode);
    if (!request || START_PREFIX[request.purpose] !== match[1]) {
      await this.telegram.send(telegramId, texts.expired, { html: true });
      return true;
    }
    if (request.status !== 'PENDING' || request.expiresAt < new Date()) {
      const text = request.status === 'CONSUMED' ? texts.alreadyUsed : texts.expired;
      await this.telegram.send(telegramId, text, { html: true });
      return true;
    }

    if (request.purpose === 'LINK') {
      await this.completeLink(request, from, user, texts);
      return true;
    }
    if (request.purpose === 'ADMIN') {
      await this.issueAdminCode(request, from, user, texts);
      return true;
    }

    if (user) {
      await this.authRepository.touchTelegramProfile(user.id, from.username ?? null);
      await this.codes.issue(request, telegramId, user);
      return true;
    }

    // Unknown Telegram user: register first, then the code is sent after the contact arrives.
    await this.repository.update(request.id, { status: 'AWAITING_CONTACT', telegramId });
    await this.telegram.send(telegramId, texts.askContact, { html: true, replyMarkup: contactKeyboard(texts) });
    return true;
  }

  /** Plain `/start`: existing users are greeted; new users are asked to register. */
  async handlePlainStart(from: TelegramFrom): Promise<User | null> {
    const user = await this.authRepository.findUserByTelegramId(BigInt(from.id));
    if (user) {
      await this.authRepository.touchTelegramProfile(user.id, from.username ?? null);
      return user;
    }
    const texts = loginText(from.languageCode);
    await this.telegram.send(BigInt(from.id), texts.welcomeNew, { html: true, replyMarkup: contactKeyboard(texts) });
    return null;
  }

  /**
   * A shared contact registers the sender. Only a contact about the sender themselves counts:
   * forwarding someone else's contact card must never create or unlock an account.
   */
  /** Returns the (possibly new) user when the contact was accepted. */
  async handleContact(from: TelegramFrom, contact: TelegramContact): Promise<User | null> {
    const telegramId = BigInt(from.id);
    let user = await this.authRepository.findUserByTelegramId(telegramId);
    const pending = await this.repository.findAwaitingContact(telegramId);
    // Signing up from the website: the page's language. From the bot alone: Telegram's.
    const locale = toAppLocale(user?.locale ?? pending?.locale ?? from.languageCode);
    if (contact.userId !== from.id) {
      const texts = loginText(locale);
      await this.telegram.send(telegramId, texts.contactNotYours, { html: true, replyMarkup: contactKeyboard(texts) });
      return null;
    }

    if (!user) {
      const phone = normalizePhone(contact.phoneNumber);
      try {
        user = await this.authRepository.createTelegramUser({
          name: displayName(from),
          telegramId,
          telegramUsername: from.username ?? null,
          phone: (await this.authRepository.isPhoneTaken(phone)) ? null : phone,
          locale,
        });
      } catch (err) {
        // A double tap on "share contact" races two registrations; the unique key keeps one.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
        user = await this.authRepository.findUserByTelegramId(telegramId);
        if (!user) throw err;
      }
    }

    const texts = loginText(user.locale);
    await this.telegram.send(telegramId, pending ? texts.registered : texts.registeredPlain, {
      html: true,
      replyMarkup: { remove_keyboard: true },
    });
    if (pending) {
      await this.codes.issue(pending, telegramId, user);
    }
    return user;
  }

  /** "Bu men emasman" under a code: kills the request so the code can no longer be redeemed. */
  async handleCancel(requestId: string, fromId: number): Promise<void> {
    const request = await this.repository.findById(requestId);
    if (!request || request.telegramId !== BigInt(fromId)) return;
    if (await this.repository.transition(request.id, ['PENDING', 'AWAITING_CONTACT', 'CODE_SENT'], 'CANCELLED')) {
      const user = await this.authRepository.findUserByTelegramId(BigInt(fromId));
      await this.telegram.send(BigInt(fromId), loginText(user?.locale ?? request.locale).cancelled, { html: true });
    }
  }

  /**
   * A banned account's `/start <payload>`: the sign-in it would complete is cancelled, so the
   * waiting page says so at once instead of running out its time.
   */
  async cancelForBanned(payload: string): Promise<void> {
    const match = /^(login|link|admin)_([A-Za-z0-9_-]{16,64})$/.exec(payload);
    if (!match) return;
    const request = await this.repository.findByNonceHash(hashNonce(match[2]));
    if (request) await this.repository.transition(request.id, ['PENDING'], 'CANCELLED');
  }

  /**
   * Admin sign-in: a code only for a registered account on the admin list. Anyone else gets the
   * ordinary "link expired" reply, so the bot never confirms that an admin panel exists.
   */
  private async issueAdminCode(
    request: TelegramLoginRequest,
    from: TelegramFrom,
    account: User | null,
    texts: LoginTexts,
  ): Promise<void> {
    const telegramId = BigInt(from.id);
    const allowed = this.adminAccess.isAdmin(telegramId);
    const user = allowed ? account : null;
    if (user) {
      await this.codes.issue(request, telegramId, user);
      return;
    }

    await this.repository.transition(request.id, ['PENDING'], 'CANCELLED');
    await this.audit.record({
      action: 'LOGIN_DENIED',
      telegramId,
      ipAddress: request.ipAddress,
      meta: { reason: allowed ? 'no_account' : 'not_admin', username: from.username ?? null },
    });
    // Word for word an expired link, in the same language, so nothing gives the panel away.
    await this.telegram.send(telegramId, allowed ? ADMIN_LOGIN_TEXT.noAccount : texts.expired, { html: true });
  }

  private async completeLink(
    request: TelegramLoginRequest,
    from: TelegramFrom,
    owner: User | null,
    texts: LoginTexts,
  ): Promise<void> {
    const telegramId = BigInt(from.id);
    if (!request.userId || (owner && owner.id !== request.userId)) {
      await this.repository.transition(request.id, ['PENDING'], 'CANCELLED');
      await this.telegram.send(telegramId, texts.linkConflict, { html: true });
      return;
    }

    await this.authRepository.linkTelegram(request.userId, telegramId, from.username ?? null);
    await this.repository.update(request.id, { status: 'CONSUMED', telegramId, consumedAt: new Date() });
    await this.sessions.forgetUser(request.userId);
    await this.telegram.send(telegramId, texts.linked, { html: true });
  }
}
