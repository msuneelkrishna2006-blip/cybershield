UPDATE "users"
SET "mfa_enabled" = false
WHERE "mfa_secret" IS NOT NULL;

ALTER TABLE "users"
DROP COLUMN "mfa_secret";

ALTER TABLE "mfa_secrets"
ADD COLUMN "last_used_step" INTEGER NOT NULL DEFAULT -1;

ALTER TABLE "sessions"
ADD COLUMN "last_reauth_at" TIMESTAMP(3);

CREATE TABLE "pending_mfa_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pending_mfa_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pending_mfa_challenges_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "pending_mfa_challenges_token_hash_key"
ON "pending_mfa_challenges"("token_hash");

CREATE INDEX "pending_mfa_challenges_user_id_expires_at_idx"
ON "pending_mfa_challenges"("user_id", "expires_at");
