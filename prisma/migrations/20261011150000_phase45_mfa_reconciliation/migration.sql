UPDATE "users" AS u
SET "mfa_enabled" = false
WHERE u."mfa_enabled" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "mfa_secrets" AS m
    WHERE m."user_id" = u."id"
      AND m."verified_at" IS NOT NULL
  );
