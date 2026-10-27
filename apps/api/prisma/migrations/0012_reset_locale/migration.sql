-- Sign-up stored the Telegram language (ru/en) while the app spoke only Uzbek. Russian is now
-- selectable, so everyone keeps the Uzbek they have seen so far and switches by choice.
UPDATE "users" SET "locale" = 'uz' WHERE "locale" <> 'uz';
