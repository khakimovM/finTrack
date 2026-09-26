import { Injectable } from '@nestjs/common';
import { AccountsRepository } from './accounts.repository';
import {
  AccountArchivedException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';

/** Shared rule for every module that adds ledger rows: the account must be the user's and active. */
@Injectable()
export class AccountAccessService {
  constructor(private readonly accounts: AccountsRepository) {}

  async assertWritable(userId: string, accountId: string, notFoundMessage = 'Hisob topilmadi'): Promise<void> {
    if (await this.accounts.findActiveById(userId, accountId)) return;
    if (await this.accounts.findById(userId, accountId)) {
      throw new AccountArchivedException({ accountId });
    }
    throw new NotFoundDomainException(notFoundMessage);
  }
}
