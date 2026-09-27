import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../infra/redis/redis.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { durationToMs } from '../../common/utils/duration';

const USER_ALIVE_TTL_SECONDS = 60;

/**
 * Access tokens are stateless JWTs; this adds the two checks a finance app cannot skip:
 * a revoked session (logout-all, "end this session") and a deleted account stop working
 * immediately instead of when the token expires.
 */
@Injectable()
export class SessionStateService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async revokeSessions(familyIds: string[]): Promise<void> {
    // An access token can outlive its revocation by at most its own lifetime.
    const ttl = Math.ceil(durationToMs(this.config.get<string>('ACCESS_TOKEN_TTL', '15m')) / 1000);
    await Promise.all(familyIds.map((id) => this.redis.set(`auth:revoked:${id}`, '1', ttl)));
  }

  async forgetUser(userId: string): Promise<void> {
    await this.redis.del(`auth:alive:${userId}`);
  }

  /** Fails open when Redis is down: tokens are short-lived and the DB check still runs. */
  async isSessionRevoked(familyId: string | undefined): Promise<boolean> {
    if (!familyId) return false;
    return (await this.redis.get(`auth:revoked:${familyId}`)) !== null;
  }

  async isUserActive(userId: string): Promise<boolean> {
    const key = `auth:alive:${userId}`;
    if ((await this.redis.get(key)) === '1') return true;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) return false;
    await this.redis.set(key, '1', USER_ALIVE_TTL_SECONDS);
    return true;
  }
}
