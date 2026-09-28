import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { AuthCookiesService } from './auth-cookies.service';
import { SessionStateService } from './session-state.service';
import { TelegramLoginRepository } from './telegram-login.repository';
import { TelegramLoginService } from './telegram-login.service';
import { TelegramLoginBotService } from './telegram-login-bot.service';
import { LoginCodeService } from './login-code.service';
import { TelegramWebAppService } from './telegram-webapp.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    AuthCookiesService,
    SessionStateService,
    TelegramLoginRepository,
    TelegramLoginService,
    TelegramLoginBotService,
    LoginCodeService,
    TelegramWebAppService,
  ],
  exports: [
    AuthService,
    AuthRepository,
    AuthCookiesService,
    SessionStateService,
    TelegramLoginService,
    TelegramLoginBotService,
  ],
})
export class AuthModule {}
