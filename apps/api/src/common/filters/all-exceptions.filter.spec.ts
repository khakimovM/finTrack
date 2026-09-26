import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { DomainException, NotFoundDomainException } from '../exceptions/domain.exception';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockStatus: jest.Mock;
  let mockSend: jest.Mock;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockSend = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ send: mockSend });

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ id: 'test-req-123' }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('should format DomainException according to contract', () => {
    const exception = new DomainException('Hisobda mablag‘ yetarli emas', 'INSUFFICIENT_BALANCE', HttpStatus.UNPROCESSABLE_ENTITY, {
      currentBalance: '1000',
    });

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Hisobda mablag‘ yetarli emas',
          details: { currentBalance: '1000' },
        },
        meta: expect.objectContaining({
          requestId: 'test-req-123',
        }),
      }),
    );
  });

  it('should format NotFoundDomainException with 404', () => {
    const exception = new NotFoundDomainException('Foydalanuvchi topilmadi');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Foydalanuvchi topilmadi',
        },
      }),
    );
  });

  it('should format generic HttpException', () => {
    const exception = new HttpException('Forbidden resource', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Forbidden resource',
        },
      }),
    );
  });

  it('should format unhandled Error with 500 without leaking stack trace', () => {
    const exception = new Error('Database password was leaked in raw log');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Kutilmagan server xatosi yuz berdi',
        },
      }),
    );
  });
});
