-- CreateEnum
CREATE TYPE "ActivityChannel" AS ENUM ('WEB', 'MINIAPP', 'BOT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('WEB', 'MINIAPP', 'BOT', 'VOICE', 'RECURRING');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ban_reason" VARCHAR(300),
ADD COLUMN     "banned_at" TIMESTAMP(3),
ADD COLUMN     "last_seen_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "source" "TransactionSource";

-- CreateTable
CREATE TABLE "user_activity_days" (
    "user_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "channel" "ActivityChannel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activity_days_pkey" PRIMARY KEY ("user_id","day","channel")
);

-- CreateIndex
CREATE INDEX "user_activity_days_day_idx" ON "user_activity_days"("day");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- AddForeignKey
ALTER TABLE "user_activity_days" ADD CONSTRAINT "user_activity_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: the days people were active before activity was recorded, from what the ledger and
-- the session table already hold. The channel is unknown for them. Days are Asia/Tashkent
-- calendar days, like the live recorder's. ON CONFLICT keeps a re-run harmless.
INSERT INTO "user_activity_days" ("user_id", "day", "channel")
SELECT DISTINCT "user_id", ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')::date, 'UNKNOWN'::"ActivityChannel"
FROM "transactions"
WHERE "recurring_rule_id" IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "user_activity_days" ("user_id", "day", "channel")
SELECT DISTINCT "user_id", ("created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent')::date, 'UNKNOWN'::"ActivityChannel"
FROM "refresh_tokens"
ON CONFLICT DO NOTHING;

UPDATE "users" u
SET "last_seen_at" = seen."at"
FROM (
  SELECT "user_id", MAX("created_at") AS "at" FROM (
    SELECT "user_id", "created_at" FROM "transactions" WHERE "recurring_rule_id" IS NULL
    UNION ALL
    SELECT "user_id", "created_at" FROM "refresh_tokens"
  ) AS events
  GROUP BY "user_id"
) AS seen
WHERE seen."user_id" = u."id" AND u."last_seen_at" IS NULL;
