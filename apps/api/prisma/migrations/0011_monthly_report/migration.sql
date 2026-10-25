-- Monthly report (text and voice) on the last day of the month: on for everyone, switched off per user.
ALTER TABLE "users" ADD COLUMN "monthly_report" BOOLEAN NOT NULL DEFAULT true;
