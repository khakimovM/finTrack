import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { UsersService } from './users.service';
import { DeleteAccountDto, UpdateProfileDto } from './dto/user.dto';
import { AuthService } from '../auth/auth.service';
import { AuthCookiesService } from '../auth/auth-cookies.service';
import { TelegramLoginService } from '../auth/telegram-login.service';
import { requestMeta } from '../auth/auth.controller';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@Controller({ path: 'users/me', version: '1' })
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly authService: AuthService,
    private readonly telegramLogin: TelegramLoginService,
    private readonly cookies: AuthCookiesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Joriy foydalanuvchi profili' })
  async me(@CurrentUser('id') userId: string) {
    return { user: await this.authService.getMe(userId) };
  }

  @Patch()
  @ApiOperation({ summary: 'Profil va sozlamalarni yangilash (ism, til, vaqt zonasi, qatʼiy rejim, bildirishnomalar)' })
  async update(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return { user: await this.users.updateProfile(userId, dto) };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Faol sessiyalar (qurilmalar)' })
  async sessions(@CurrentUser('id') userId: string, @CurrentUser('sessionId') sessionId?: string) {
    return this.authService.getSessions(userId, sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sessiyani yakunlash' })
  async revokeSession(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.authService.revokeSession(userId, id);
  }

  /** For accounts created before Telegram sign-in: returns a bot deep link that links this profile. */
  @Post('telegram/link')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Telegram hisobini ulash' })
  async linkTelegram(@CurrentUser('id') userId: string, @Req() req: FastifyRequest) {
    const { requestId, deepLink, expiresAt } = await this.telegramLogin.start(requestMeta(req), 'LINK', userId);
    return { requestId, deepLink, expiresAt };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Akkauntni va barcha maʼlumotlarni o‘chirish' })
  async deleteAccount(
    @CurrentUser('id') userId: string,
    @Body() _dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.users.deleteAccount(userId);
    this.cookies.clear(res);
    return { message: 'Akkaunt o‘chirildi' };
  }
}
