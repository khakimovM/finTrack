-- Card import (C0): operations forwarded from the Uzcard and Humo bots, the cards they belong to,
-- each forwarded burst, and the category every shop was given. Additive only.

-- CreateEnum
CREATE TYPE "CardNetwork" AS ENUM ('UZCARD', 'HUMO');

-- CreateEnum
CREATE TYPE "CardOperationDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "CardOperationStatus" AS ENUM ('PENDING', 'SAVED', 'LINKED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "CardResolution" AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER', 'DEBT', 'DUPLICATE', 'CANCELLED', 'SKIP');

-- CreateEnum
CREATE TYPE "CardCategorySource" AS ENUM ('MEMORY', 'KNOWN', 'GUESS', 'AI', 'USER');

-- AlterEnum
ALTER TYPE "TransactionSource" ADD VALUE 'CARD';

-- CreateTable
CREATE TABLE "payment_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "network" "CardNetwork" NOT NULL,
    "last4" VARCHAR(4) NOT NULL,
    "account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_imports" (
    "id" VARCHAR(12) NOT NULL,
    "user_id" TEXT NOT NULL,
    "ignored" INTEGER NOT NULL DEFAULT 0,
    "repeated" INTEGER NOT NULL DEFAULT 0,
    "planned_at" TIMESTAMP(3),
    "saved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_operations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "import_id" VARCHAR(12),
    "seq" INTEGER,
    "fingerprint" VARCHAR(64) NOT NULL,
    "direction" "CardOperationDirection" NOT NULL,
    "amount" BIGINT NOT NULL,
    "merchant" VARCHAR(200) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "date" DATE NOT NULL,
    "balance_after" BIGINT,
    "reversal" BOOLEAN NOT NULL DEFAULT false,
    "status" "CardOperationStatus" NOT NULL DEFAULT 'PENDING',
    "resolution" "CardResolution",
    "category_id" TEXT,
    "category_source" "CardCategorySource",
    "counter_account_id" TEXT,
    "paired_id" TEXT,
    "debt_person" VARCHAR(100),
    "transaction_id" TEXT,
    "transfer_group_id" TEXT,
    "debt_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_categories" (
    "user_id" TEXT NOT NULL,
    "merchant_key" VARCHAR(200) NOT NULL,
    "category_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_categories_pkey" PRIMARY KEY ("user_id","merchant_key")
);

-- CreateIndex
CREATE INDEX "payment_cards_account_id_idx" ON "payment_cards"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_cards_user_id_network_last4_key" ON "payment_cards"("user_id", "network", "last4");

-- CreateIndex
CREATE INDEX "card_imports_user_id_created_at_idx" ON "card_imports"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "card_operations_user_id_status_idx" ON "card_operations"("user_id", "status");

-- CreateIndex
CREATE INDEX "card_operations_card_id_occurred_at_idx" ON "card_operations"("card_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "card_operations_user_id_fingerprint_key" ON "card_operations"("user_id", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "card_operations_import_id_seq_key" ON "card_operations"("import_id", "seq");

-- CreateIndex
CREATE INDEX "merchant_categories_category_id_idx" ON "merchant_categories"("category_id");

-- AddForeignKey
ALTER TABLE "payment_cards" ADD CONSTRAINT "payment_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_cards" ADD CONSTRAINT "payment_cards_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_imports" ADD CONSTRAINT "card_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_operations" ADD CONSTRAINT "card_operations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_operations" ADD CONSTRAINT "card_operations_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "payment_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_operations" ADD CONSTRAINT "card_operations_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "card_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_categories" ADD CONSTRAINT "merchant_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_categories" ADD CONSTRAINT "merchant_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

