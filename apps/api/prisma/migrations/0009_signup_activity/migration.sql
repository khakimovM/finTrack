-- Signing up is using FinTrack: the bot records the registering message as that day's activity.
-- Accounts made before activity was recorded got their days only from entries and sign-ins
-- (0006), so one that registered in the bot and did nothing else that day had more new users than
-- active ones on the admin panel's charts. Their sign-up day is added with the channel unknown,
-- only where the day has no row at all: live channels are not doubled. A re-run adds nothing.
INSERT INTO "user_activity_days" ("user_id", "day", "channel")
SELECT u."id", (u."created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')::date, 'UNKNOWN'::"ActivityChannel"
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "user_activity_days" a
  WHERE a."user_id" = u."id"
    AND a."day" = (u."created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')::date
)
ON CONFLICT DO NOTHING;
