import { todayInTimeZone } from '@fintrack/shared';
import { FutureDateException } from '../../../common/exceptions/domain.exception';
import { ClockService } from '../clock.service';

const TZ = 'Asia/Tashkent';

/** Real "today" semantics without a database: use in service unit tests. */
export function clockStub(): jest.Mocked<Pick<ClockService, 'now' | 'todayFor' | 'todayIn' | 'assertNotFuture' | 'timeZoneFor'>> {
  return {
    now: jest.fn(() => new Date()),
    todayIn: jest.fn((tz: string) => todayInTimeZone(tz)),
    timeZoneFor: jest.fn(async (_userId: string) => TZ),
    todayFor: jest.fn(async (_userId: string) => todayInTimeZone(TZ)),
    assertNotFuture: jest.fn(async (_userId: string, date: string) => {
      if (date > todayInTimeZone(TZ)) throw new FutureDateException();
    }),
  };
}
