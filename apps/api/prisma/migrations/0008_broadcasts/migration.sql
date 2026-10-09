-- CreateEnum
CREATE TYPE "BroadcastSegment" AS ENUM ('ALL', 'ACTIVE_30D', 'INACTIVE_30D');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('QUEUED', 'SENDING', 'DONE');

-- CreateEnum
CREATE TYPE "BroadcastDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'BLOCKED', 'FAILED');

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "text" VARCHAR(4096) NOT NULL,
    "segment" "BroadcastSegment" NOT NULL,
    "include_opted_out" BOOLEAN NOT NULL DEFAULT false,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'QUEUED',
    "total" INTEGER NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "blocked" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_recipients" (
    "broadcast_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "status" "BroadcastDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "claimed_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "error" VARCHAR(200),

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("broadcast_id","user_id")
);

-- CreateIndex
CREATE INDEX "broadcasts_created_at_idx" ON "broadcasts"("created_at");

-- CreateIndex
CREATE INDEX "broadcast_recipients_broadcast_id_status_idx" ON "broadcast_recipients"("broadcast_id", "status");

-- AddForeignKey
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

