-- DropIndex
DROP INDEX "user_activity_days_day_idx";

-- DropIndex
DROP INDEX "transactions_created_at_idx";

-- CreateIndex
CREATE INDEX "user_activity_days_day_user_id_idx" ON "user_activity_days"("day", "user_id");

-- CreateIndex
CREATE INDEX "transactions_created_at_type_idx" ON "transactions"("created_at", "type");

