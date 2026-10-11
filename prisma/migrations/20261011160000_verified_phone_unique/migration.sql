DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users"
    WHERE "phone" IS NOT NULL
      AND "phone_verified_at" IS NOT NULL
    GROUP BY "phone"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce verified phone uniqueness: duplicate verified phone numbers exist. Resolve them explicitly before retrying this migration.';
  END IF;
END
$$;

DROP INDEX "users_phone_key";

CREATE INDEX "users_phone_idx"
ON "users"("phone");

CREATE UNIQUE INDEX "users_phone_verified_key"
ON "users"("phone")
WHERE "phone_verified_at" IS NOT NULL;
