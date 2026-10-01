import { Injectable, Logger } from '@nestjs/common';
import { UpdateProfileInput, UserResponse } from '@fintrack/shared';
import { UsersRepository } from './users.repository';
import { AuthService } from '../auth/auth.service';
import { AuthRepository } from '../auth/auth.repository';
import { SessionStateService } from '../auth/session-state.service';
import { BalanceService } from '../accounts/balance.service';
import { TelegramBotService } from '../../infra/telegram/telegram-bot.service';
import { NotFoundDomainException } from '../../common/exceptions/domain.exception';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly repository: UsersRepository,
    private readonly authService: AuthService,
    private readonly authRepository: AuthRepository,
    private readonly sessions: SessionStateService,
    private readonly balanceService: BalanceService,
    private readonly telegram: TelegramBotService,
  ) {}

  async updateProfile(userId: string, dto: UpdateProfileInput): Promise<UserResponse> {
    const updated = await this.repository.updateProfile(userId, dto);
    // The user's time zone decides which day "today" is for stats and budgets.
    if (dto.timezone !== undefined) await this.balanceService.invalidate(userId);
    return this.authService.toUserResponse(updated);
  }

  /** Irreversible: sessions die immediately, then every row the user owns is erased. */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) throw new NotFoundDomainException('Foydalanuvchi topilmadi');

    await this.authService.logoutAll(userId);
    await this.repository.deleteUserData(userId);
    await this.sessions.forgetUser(userId);
    await this.balanceService.invalidate(userId);

    if (user.telegramId !== null) {
      await this.telegram
        .send(user.telegramId, 'Hisobingiz va barcha maʼlumotlaringiz o‘chirildi. Xayr! 👋')
        .catch(() => undefined);
    }
    this.logger.log(`Account ${userId} deleted by its owner`);
  }
}
