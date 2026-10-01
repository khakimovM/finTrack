-- CreateEnum
CREATE TYPE "TelegramLoginPurpose" AS ENUM ('LOGIN', 'LINK');

-- CreateEnum
CREATE TYPE "TelegramLoginStatus" AS ENUM ('PENDING', 'AWAITING_CONTACT', 'CODE_SENT', 'CONSUMED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "daily_digest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notify_telegram" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "telegram_blocked_at" TIMESTAMP(3),
ADD COLUMN     "telegram_id" BIGINT,
ADD COLUMN     "telegram_username" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "telegram_login_requests" (
    "id" TEXT NOT NULL,
    "purpose" "TelegramLoginPurpose" NOT NULL DEFAULT 'LOGIN',
    "nonce_hash" TEXT NOT NULL,
    "status" "TelegramLoginStatus" NOT NULL DEFAULT 'PENDING',
    "user_id" TEXT,
    "telegram_id" BIGINT,
    "code_hash" TEXT,
    "code_expires_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "codes_sent" INTEGER NOT NULL DEFAULT 0,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_login_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_login_requests_nonce_hash_key" ON "telegram_login_requests"("nonce_hash");

-- CreateIndex
CREATE INDEX "telegram_login_requests_telegram_id_created_at_idx" ON "telegram_login_requests"("telegram_id", "created_at");

-- CreateIndex
CREATE INDEX "telegram_login_requests_expires_at_idx" ON "telegram_login_requests"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- AddForeignKey
ALTER TABLE "telegram_login_requests" ADD CONSTRAINT "telegram_login_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

