-- Morning (07:00) and evening (22:00) bot reminders: on for everyone, switched off per user.
ALTER TABLE "users" ADD COLUMN "daily_reminders" BOOLEAN NOT NULL DEFAULT true;
