-- The sign-in page's language, so an account created from it starts in that language.
ALTER TABLE "telegram_login_requests" ADD COLUMN "locale" VARCHAR(5);
