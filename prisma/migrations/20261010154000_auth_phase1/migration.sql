CREATE TYPE "auth_role" AS ENUM ('GUARDIAN', 'CHILD', 'ADMIN');

ALTER TABLE "users"
ADD COLUMN "email_verified_at" TIMESTAMP(3),
ADD COLUMN "role" "auth_role" NOT NULL DEFAULT 'CHILD';

ALTER TABLE "sessions"
ADD COLUMN "revoked_at" TIMESTAMP(3);

CREATE TABLE "credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mfa_secrets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mfa_secrets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recovery_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aadhaar_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_reference_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "last_four_encrypted" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "aadhaar_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "consented_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMP(3),
    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "event_type" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credentials_user_id_key" ON "credentials"("user_id");
CREATE INDEX "credentials_created_at_idx" ON "credentials"("created_at");
CREATE INDEX "otp_challenges_phone_sent_at_idx" ON "otp_challenges"("phone", "sent_at");
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");
CREATE INDEX "otp_challenges_user_id_created_at_idx" ON "otp_challenges"("user_id", "created_at");
CREATE UNIQUE INDEX "email_tokens_token_hash_key" ON "email_tokens"("token_hash");
CREATE INDEX "email_tokens_user_id_purpose_expires_at_idx" ON "email_tokens"("user_id", "purpose", "expires_at");
CREATE UNIQUE INDEX "mfa_secrets_user_id_key" ON "mfa_secrets"("user_id");
CREATE UNIQUE INDEX "recovery_codes_code_hash_key" ON "recovery_codes"("code_hash");
CREATE INDEX "recovery_codes_user_id_used_at_idx" ON "recovery_codes"("user_id", "used_at");
CREATE UNIQUE INDEX "aadhaar_verifications_provider_reference_id_key" ON "aadhaar_verifications"("provider_reference_id");
CREATE INDEX "aadhaar_verifications_user_id_status_idx" ON "aadhaar_verifications"("user_id", "status");
CREATE INDEX "consents_user_id_purpose_consented_at_idx" ON "consents"("user_id", "purpose", "consented_at");
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");
CREATE INDEX "audit_logs_event_type_created_at_idx" ON "audit_logs"("event_type", "created_at");

ALTER TABLE "credentials"
ADD CONSTRAINT "credentials_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "otp_challenges"
ADD CONSTRAINT "otp_challenges_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_tokens"
ADD CONSTRAINT "email_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_secrets"
ADD CONSTRAINT "mfa_secrets_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recovery_codes"
ADD CONSTRAINT "recovery_codes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "aadhaar_verifications"
ADD CONSTRAINT "aadhaar_verifications_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consents"
ADD CONSTRAINT "consents_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
