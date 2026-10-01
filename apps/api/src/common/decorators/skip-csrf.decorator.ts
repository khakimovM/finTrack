import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skipCsrf';

/** For machine-to-machine endpoints (e.g. the Telegram webhook) that never carry our cookies. */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
