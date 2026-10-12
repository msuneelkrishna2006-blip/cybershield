-- Remove legacy plaintext JWTs; the deleted rows can no longer authorize refreshes.
DELETE FROM "refresh_tokens";

UPDATE "sessions"
SET "revoked_at" = CURRENT_TIMESTAMP
WHERE "revoked_at" IS NULL;
