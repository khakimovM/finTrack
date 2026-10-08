import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ClockService } from '../../infra/clock/clock.service';
import { AdminAccessService } from './core/admin-access.service';
import { TokenMeta } from '../auth/auth.service';

/** Decided with the owner (docs/09): 8 hours at most, and 1 hour without a request ends it. */
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60_000;
export const ADMIN_IDLE_MS = 60 * 60_000;
/** `lastUsedAt` is written at most once a minute, not on every request. */
const TOUCH_EVERY_MS = 60_000;

/** The admin behind a request, set by AdminGuard. */
export interface AdminPrincipal {
  sessionId: string;
  userId: string;
  expiresAt: Date;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AdminSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AdminAccessService,
    private readonly clock: ClockService,
  ) {}

  /** A new session; the returned token goes into the cookie and is never stored. */
  async create(userId: string, meta: TokenMeta): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_MS);
    await this.prisma.adminSession.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        createdAt: now,
        lastUsedAt: now,
        expiresAt,
      },
    });
    return { token, expiresAt };
  }

  /**
   * The admin a cookie token belongs to, or null. Admin rights are checked on every request
   * against ADMIN_TELEGRAM_IDS: taking an id off the list ends that admin's sessions at once.
   */
  async resolve(token: string | undefined): Promise<AdminPrincipal | null> {
    if (!token) return null;
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { telegramId: true, deletedAt: true } } },
    });
    const now = this.clock.now().getTime();
    if (!session || session.revokedAt || session.expiresAt.getTime() <= now) return null;
    const idle = now - session.lastUsedAt.getTime();
    if (idle > ADMIN_IDLE_MS) return null;
    if (session.user.deletedAt || !this.access.isAdmin(session.user.telegramId)) return null;

    if (idle > TOUCH_EVERY_MS) {
      await this.prisma.adminSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date(now) } });
    }
    return { sessionId: session.id, userId: session.userId, expiresAt: session.expiresAt };
  }

  /** Ends the session of this token; returns who it was, for the audit log. */
  async revoke(token: string | undefined): Promise<{ userId: string } | null> {
    if (!token) return null;
    const session = await this.prisma.adminSession.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session || session.revokedAt) return null;
    await this.prisma.adminSession.update({ where: { id: session.id }, data: { revokedAt: this.clock.now() } });
    return { userId: session.userId };
  }
}
