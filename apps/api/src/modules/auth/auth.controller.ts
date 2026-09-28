import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService, TokenMeta } from './auth.service';
import { AuthCookiesService } from './auth-cookies.service';
import { TelegramLoginService } from './telegram-login.service';
import { TelegramWebAppService } from './telegram-webapp.service';
import { TelegramRequestRefDto, TelegramWebAppAuthDto, VerifyTelegramLoginDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

export function requestMeta(req: FastifyRequest): TokenMeta {
  return {
    userAgent: req.headers['user-agent'] as string | undefined,
    ipAddress: req.ip,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly telegramLogin: TelegramLoginService,
    private readonly cookies: AuthCookiesService,
    private readonly webApp: TelegramWebAppService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('telegram/start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Telegram orqali kirishni boshlash (bot deep link)' })
  async startTelegramLogin(@Req() req: FastifyRequest) {
    return this.telegramLogin.start(requestMeta(req));
  }

  /** Polled by the login page every ~2s while the user is in Telegram. */
  @Public()
  @SkipThrottle()
  @Get('telegram/status/:requestId')
  @ApiOperation({ summary: 'Kirish so‘rovi holati' })
  async telegramLoginStatus(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.telegramLogin.status(requestId);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('telegram/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegramdan kelgan 6 xonali kodni tasdiqlash' })
  @ApiResponse({ status: 400, description: 'OTP_INVALID' })
  @ApiResponse({ status: 422, description: 'OTP_EXPIRED' })
  @ApiResponse({ status: 429, description: 'OTP_ATTEMPTS_EXCEEDED' })
  async verifyTelegramLogin(
    @Body() dto: VerifyTelegramLoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.telegramLogin.verify(dto, requestMeta(req));
    this.cookies.set(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('telegram/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kodni qayta yuborish' })
  async resendTelegramCode(@Body() dto: TelegramRequestRefDto) {
    return this.telegramLogin.resend(dto.requestId);
  }

  /** Telegram Mini App sign-in: no cookies, the access token travels in the body (see schema). */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('telegram/webapp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram Mini App: initData evaziga access token' })
  @ApiResponse({ status: 401, description: 'TELEGRAM_INIT_DATA_INVALID | TELEGRAM_INIT_DATA_EXPIRED' })
  @ApiResponse({ status: 403, description: 'TELEGRAM_NOT_REGISTERED' })
  async telegramWebApp(@Body() dto: TelegramWebAppAuthDto, @Req() req: FastifyRequest) {
    return this.webApp.exchange(dto.initData, requestMeta(req));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
    try {
      const result = await this.authService.refresh(cookies?.refreshToken, requestMeta(req));
      this.cookies.set(res, result.accessToken, result.refreshToken);
      return { user: result.user };
    } catch (err) {
      // A lost race must keep the cookie the winning request just set.
      const code = (err as { getResponse?: () => { code?: string } }).getResponse?.().code;
      if (code !== 'REFRESH_RACE') this.cookies.clear(res);
      throw err;
    }
  }

  /** Public so a user whose access token already expired can still end the session cleanly. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out current session' })
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
    await this.authService.logout(cookies?.refreshToken);
    this.cookies.clear(res);
    return { message: 'Tizimdan muvaffaqiyatli chiqildi' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out all sessions' })
  async logoutAll(@CurrentUser('id') userId: string, @Res({ passthrough: true }) res: FastifyReply) {
    await this.authService.logoutAll(userId);
    this.cookies.clear(res);
    return { message: 'Barcha sessiyalardan chiqildi' };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser('id') userId: string) {
    return { user: await this.authService.getMe(userId) };
  }
}
