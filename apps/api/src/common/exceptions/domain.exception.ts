import { HttpStatus } from '@nestjs/common';

export class DomainException extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code = 'DOMAIN_ERROR',
    status = HttpStatus.UNPROCESSABLE_ENTITY,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class NotFoundDomainException extends DomainException {
  constructor(message = 'Resurs topilmadi', details?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', HttpStatus.NOT_FOUND, details);
  }
}

export class InsufficientBalanceException extends DomainException {
  constructor(message = 'Balansingiz yetarli emas', details?: Record<string, unknown>) {
    super(message, 'INSUFFICIENT_BALANCE', HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class DebtOverpaymentException extends DomainException {
  constructor(message = 'Ortiqcha to‘lov kiritildi', details?: Record<string, unknown>) {
    super(message, 'DEBT_OVERPAYMENT', HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class ConflictDomainException extends DomainException {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message, code, HttpStatus.CONFLICT, details);
  }
}

export class SystemCategoryException extends DomainException {
  constructor(message = 'Tizim kategoriyasini o‘chirib bo‘lmaydi', details?: Record<string, unknown>) {
    super(message, 'SYSTEM_CATEGORY', HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class InvalidTransactionTypeException extends DomainException {
  constructor(
    message = 'LOAN va TRANSFER turlarini bu endpoint orqali yaratib bo‘lmaydi',
    details?: Record<string, unknown>,
  ) {
    super(message, 'INVALID_TRANSACTION_TYPE', HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class InvalidCategoryTypeException extends DomainException {
  constructor(
    message = 'Kategoriya turi tranzaksiya turiga mos kelishi kerak',
    details?: Record<string, unknown>,
  ) {
    super(message, 'INVALID_CATEGORY_TYPE', HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class SameAccountTransferException extends DomainException {
  constructor(
    message = 'Bir xil hisoblar o‘rtasida o‘tkazma qilib bo‘lmaydi',
    details?: Record<string, unknown>,
  ) {
    super(message, 'SAME_ACCOUNT_TRANSFER', HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class FutureDateException extends DomainException {
  constructor(
    message = 'Kelajakdagi sana bilan tranzaksiya kiritib bo‘lmaydi',
    details?: Record<string, unknown>,
  ) {
    super(message, 'FUTURE_DATE', HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}


/** Transfer and loan rows are edited through /transfers and /debts, never /transactions. */
export class ManagedTransactionException extends DomainException {
  constructor(details?: Record<string, unknown>) {
    super(
      'Bu yozuv o‘tkazma yoki qarzga tegishli. Uni o‘sha bo‘lim orqali o‘zgartiring',
      'MANAGED_TRANSACTION',
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}

export class AccountArchivedException extends DomainException {
  constructor(details?: Record<string, unknown>) {
    super(
      'Arxivlangan hisobga yozuv qo‘shib bo‘lmaydi',
      'ACCOUNT_ARCHIVED',
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}
