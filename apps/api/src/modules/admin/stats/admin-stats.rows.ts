/** Row shapes of the admin statistics queries: counts and dates only, never an amount or a name. */

export interface UserCountsRow {
  total: number;
  newToday: number;
  new7: number;
  new7Prev: number;
  new30: number;
  new30Prev: number;
  botBlocked: number;
  banned: number;
}

export interface ActiveCountsRow {
  today: number;
  d7: number;
  d7Prev: number;
  d30: number;
  d30Prev: number;
}

export interface EntryCountsRow {
  total: number;
  today: number;
  d7: number;
  d7Prev: number;
}

export interface BucketRow {
  bucket: string;
  n: number;
}

export interface CohortRow {
  week: string;
  n: number;
  users: number;
}

export interface FeatureRow {
  users: number;
  withDebt: number;
  withBudget: number;
  withRecurring: number;
  withTag: number;
  withSeveralAccounts: number;
  withOwnCategory: number;
  strictMode: number;
  dailyDigest: number;
  dailyReminders: number;
  monthlyReport: number;
  telegramNotifications: number;
}

export interface FunnelRow {
  registered: number;
  firstEntry: number;
  fiveEntries: number;
  returnedWeek2: number;
}
