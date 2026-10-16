import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AdminWebAppSessionResponse } from '@fintrack/shared';
import { Public } from '../../common/decorators/public.decorator';
import { TelegramRequestRefDto, TelegramWebAppAuthDto, VerifyTelegramLoginDto } from '../auth/dto/auth.dto';
import { requestMeta } from '../auth/auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminCookiesService } from './admin-cookies.service';
import { AdminOnly, CurrentAdmin } from './admin.guard';
import { AdminPrincipal } from './admin-session.service';

/**
 * Admin sign-in: with an admin code from the bot (`start=admin_…`) in a browser, or with the
 * Mini App's launch data from the bot's /admin button. Tighter limits than user sign-in.
 */
@ApiTags('admin')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly cookies: AdminCookiesService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('telegram/start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Admin kirishini boshlash (bot deep link, admin_)' })
  start(@Req() req: FastifyRequest) {
    return this.auth.start(requestMeta(req));
  }

  @Public()
  @SkipThrottle()
  @Get('telegram/status/:requestId')
  @ApiOperation({ summary: 'Admin kirish so‘rovi holati' })
  status(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.auth.status(requestId);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('telegram/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin kodini tasdiqlash: ft_admin sessiyasi' })
  async verify(@Body() dto: VerifyTelegramLoginDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const { token, session } = await this.auth.verify(dto, requestMeta(req));
    this.cookies.set(res, token, new Date(session.expiresAt));
    return session;
  }

  /** The bot's /admin button: Telegram's signed launch data instead of a code; no cookie. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('telegram/webapp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram ichida admin panel: initData evaziga X-Admin-Token sessiyasi' })
  @ApiResponse({ status: 401, description: 'TELEGRAM_INIT_DATA_INVALID | TELEGRAM_INIT_DATA_EXPIRED (eski yoki ishlatilgan)' })
  @ApiResponse({ status: 404, description: 'Admin emas (yoki admin panel o‘chirilgan)' })
  async webApp(@Body() dto: TelegramWebAppAuthDto, @Req() req: FastifyRequest): Promise<AdminWebAppSessionResponse> {
    const { token, session } = await this.auth.webApp(dto.initData, requestMeta(req));
    return { ...session, token };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('telegram/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin kodini qayta yuborish' })
  resend(@Body() dto: TelegramRequestRefDto) {
    return this.auth.resend(dto.requestId);
  }

  /** Public so an expired admin session can still be ended and its cookie dropped. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin paneldan chiqish' })
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    await this.auth.logout(this.cookies.read(req), requestMeta(req));
    this.cookies.clear(res);
    return { message: 'Admin paneldan chiqildi' };
  }

  @AdminOnly()
  @Get('me')
  @ApiOperation({ summary: 'Joriy admin' })
  me(@CurrentAdmin() admin: AdminPrincipal) {
    return this.auth.me(admin);
  }
}
