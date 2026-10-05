import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { dashboardApi } from './dashboard.api';
import { server } from '../../../test/server';

// The API envelope puts a service's meta next to data: { success, data: [...], meta: {...} }.
describe('dashboard API client', () => {
  it('keeps the balance trend meta (starting and ending balance)', async () => {
    server.use(
      http.get('*/api/v1/stats/balance-trend', () =>
        HttpResponse.json({
          success: true,
          data: [{ date: '2026-10-01', balance: '100', change: '100' }],
          meta: { from: '2026-10-01', to: '2026-10-31', startingBalance: '0', endingBalance: '100' },
        }),
      ),
    );
    const trend = await dashboardApi.getBalanceTrend({ from: '2026-10-01', to: '2026-10-31' });
    expect(trend.data).toHaveLength(1);
    expect(trend.meta.endingBalance).toBe('100');
  });

  it('keeps the timeseries buckets and meta', async () => {
    server.use(
      http.get('*/api/v1/stats/timeseries', () =>
        HttpResponse.json({
          success: true,
          data: [{ bucket: '2026-09-28', income: '1', expense: '2', net: '-1' }],
          meta: { groupBy: 'week', from: '2026-10-01', to: '2026-10-31', bucketCount: 1 },
        }),
      ),
    );
    const series = await dashboardApi.getTimeseries({ groupBy: 'week', from: '2026-10-01', to: '2026-10-31' });
    expect(series.data[0].bucket).toBe('2026-09-28');
    expect(series.meta.groupBy).toBe('week');
  });
});
