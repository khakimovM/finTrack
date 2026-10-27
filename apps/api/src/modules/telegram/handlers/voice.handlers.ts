import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';
import { User } from '@prisma/client';
import { BotUserService } from '../bot-user.service';
import { EntryService } from '../entry.service';
import { EntryHandlers } from './entry.handlers';
import { escapeHtml } from '../../auth/telegram-login.messages';
import { BOT_TEXTS, userLocale } from '../i18n';
import { AssistantOutcome, AssistantService } from '../../assistant/assistant.service';
import { TelegramFileError, TelegramFilesService } from '../../../infra/telegram/telegram-files.service';

/** Voice notes are ~4 KB/s; this leaves room for audio files without inviting huge uploads. */
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_TRANSCRIPT_SHOWN = 500;


function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Voice notes (and text the local parser could not read) → draft cards the user confirms. */
@Injectable()
export class VoiceHandlers {
  private readonly maxSeconds: number;

  constructor(
    private readonly users: BotUserService,
    private readonly assistant: AssistantService,
    private readonly entries: EntryService,
    private readonly entryHandlers: EntryHandlers,
    private readonly files: TelegramFilesService,
    config: ConfigService,
  ) {
    this.maxSeconds = config.get<number>('VOICE_MAX_SECONDS') ?? 60;
    entryHandlers.setFallback((ctx, user, text) => this.onUnparsedText(ctx, user, text));
  }

  register(bot: Bot): void {
    bot.chatType('private').on(['message:voice', 'message:audio'], async (ctx) => {
      const user = await this.users.resolve(ctx);
      if (!user) return;
      const media = ctx.message.voice ?? ctx.message.audio;
      if (!media) return;
      const t = BOT_TEXTS[userLocale(user)].voice;
      if (!this.assistant.voiceEnabled) return void (await ctx.reply(t.disabled, { parse_mode: 'HTML' }));
      if (media.duration > this.maxSeconds) return void (await ctx.reply(t.tooLong(this.maxSeconds)));

      await ctx.replyWithChatAction('typing').catch(() => undefined);
      let data: Buffer;
      try {
        data = await this.files.download(media.file_id, MAX_AUDIO_BYTES);
      } catch (err) {
        const tooLarge = err instanceof TelegramFileError && err.reason === 'too-large';
        return void (await ctx.reply(tooLarge ? t.tooLarge : t.downloadFailed));
      }

      const outcome = await this.assistant.fromVoice(user, {
        data,
        mimeType: media.mime_type ?? 'audio/ogg',
        fileName: ctx.message.voice ? 'voice.ogg' : (ctx.message.audio?.file_name ?? 'audio.mp3'),
      });
      await this.present(ctx, user, outcome, 'voice');
    });
  }

  /** Returns false to let the caller show the usual "write it like 50000 taksi" hint. */
  private async onUnparsedText(ctx: Context, user: User, text: string): Promise<boolean> {
    if (!this.assistant.textEnabled) return false;
    const outcome = await this.assistant.fromText(user, text);
    if (outcome.status === 'disabled' || outcome.status === 'unavailable') return false;
    if (outcome.status === 'ok' && outcome.result.entries.length === 0 && !outcome.result.debtMentioned) return false;
    await this.present(ctx, user, outcome, 'text');
    return true;
  }

  private async present(ctx: Context, user: User, outcome: AssistantOutcome, source: 'voice' | 'text'): Promise<void> {
    const t = BOT_TEXTS[userLocale(user)].voice;
    if (outcome.status !== 'ok') {
      const text = { limit: t.limit, unavailable: t.unavailable, disabled: t.disabled }[outcome.status];
      await ctx.reply(text, { parse_mode: 'HTML' });
      return;
    }

    const { transcript, entries, debtMentioned } = outcome.result;
    const lines: string[] = [];
    if (source === 'voice') {
      lines.push(transcript ? t.heard(escapeHtml(truncate(transcript, MAX_TRANSCRIPT_SHOWN))) : t.silence);
    }
    if (entries.length === 0 && !debtMentioned) lines.push(t.noAmount);
    if (entries.length > 1) lines.push(t.several(entries.length));
    if (debtMentioned) lines.push(t.debtHint);
    if (lines.length > 0) await ctx.reply(lines.join('\n\n'), { parse_mode: 'HTML' });

    for (const entry of entries) {
      const draft = await this.entries.createDraft(user, entry, source);
      await this.entryHandlers.reply(ctx, user, draft);
    }
  }
}
