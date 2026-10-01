-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupe_key" VARCHAR(200),
ADD COLUMN     "telegram_sent_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

