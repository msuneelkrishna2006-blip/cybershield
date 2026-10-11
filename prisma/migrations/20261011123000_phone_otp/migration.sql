ALTER TABLE "users"
ADD COLUMN "phone_verified_at" TIMESTAMP(3);

ALTER TABLE "otp_challenges"
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'login';

CREATE INDEX "otp_challenges_phone_purpose_sent_at_idx"
ON "otp_challenges"("phone", "purpose", "sent_at");
