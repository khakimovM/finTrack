import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AuthModule, AccountsModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
