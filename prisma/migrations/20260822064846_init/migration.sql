-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT,
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "safety_score" INTEGER NOT NULL DEFAULT 88,
    "scans_today" INTEGER NOT NULL DEFAULT 0,
    "total_scans" INTEGER NOT NULL DEFAULT 0,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "auth_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "event_type" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "auth_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "contact_info" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_families" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "public_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_family_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "family_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "age_tier" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "public_family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_scan_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "risk_level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT,
    "recommendations" TEXT DEFAULT '[]',
    "agent_results" TEXT DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "category_id" UUID,

    CONSTRAINT "public_scan_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "family_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "public_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_child_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "age_tier" TEXT NOT NULL,
    "safety_score" INTEGER NOT NULL DEFAULT 88,
    "alerts" INTEGER NOT NULL DEFAULT 0,
    "last_active" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "risk_level" TEXT NOT NULL DEFAULT 'low',
    "screen_time_rules" TEXT,
    "app_usage" TEXT,
    "device_restrictions" TEXT,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "public_child_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_child_safety_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "child_profile_id" UUID NOT NULL,
    "member_id" UUID,
    "pattern_type" TEXT NOT NULL,
    "severity_summary" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parent_notified" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "public_child_safety_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_location_shares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "shared_with" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "journey_destination" TEXT,
    "expected_arrival" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "public_location_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_incidents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "evidence" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exported_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "public_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "public_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_emergency_sos_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "location_status" TEXT,
    "sms_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "public_emergency_sos_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_relationships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guardian_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invite_token" TEXT,
    "invite_email" TEXT,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "guardian_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "activity_label" TEXT NOT NULL,
    "notes" TEXT,
    "destination" TEXT,
    "expected_duration" INTEGER NOT NULL,
    "check_in_interval" INTEGER NOT NULL DEFAULT 15,
    "grace_window" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "next_check_in_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "risk_level" TEXT,
    "risk_context" TEXT,
    "adjusted_interval" INTEGER,

    CONSTRAINT "safety_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "prompted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "response" TEXT,
    "grace_ends_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sos_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "sos_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "sos_event_id" UUID,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "guardian_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_recipients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "alert_id" UUID NOT NULL,
    "guardian_id" UUID NOT NULL,
    "notified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_via" TEXT NOT NULL DEFAULT '[]',
    "seen_at" TIMESTAMP(3),
    "response" TEXT,
    "responded_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "alert_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_pings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "location_pings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guardian_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "guardian_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threat_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_hi" TEXT,
    "parent_id" UUID,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "threat_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threat_indicators" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category_id" UUID,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "threat_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "url_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "url" TEXT NOT NULL,
    "domain" TEXT,
    "tld" TEXT,
    "has_ssl" BOOLEAN,
    "domain_age_days" INTEGER,
    "redirect_chain" TEXT,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "indicators" TEXT,
    "ssrf_blocked" BOOLEAN NOT NULL DEFAULT false,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "url_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_scans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID,
    "decoded_content" TEXT NOT NULL,
    "destination_type" TEXT NOT NULL,
    "url_analysis_id" UUID,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_hash" TEXT NOT NULL,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "latency_ms" INTEGER,
    "cost_estimate" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "scan_record_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scan_record_id" UUID NOT NULL,
    "feedback" TEXT NOT NULL,
    "user_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'analyst',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resource_id" TEXT,
    "details" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "source_ip" TEXT,
    "user_id" UUID,
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "metric_key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "otps_created_at_idx" ON "otps"("created_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_created_at_idx" ON "refresh_tokens"("created_at");

-- CreateIndex
CREATE INDEX "auth_audit_logs_user_id_idx" ON "auth_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "auth_audit_logs_created_at_idx" ON "auth_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets"("created_at");

-- CreateIndex
CREATE INDEX "public_families_owner_id_idx" ON "public_families"("owner_id");

-- CreateIndex
CREATE INDEX "public_families_created_at_idx" ON "public_families"("created_at");

-- CreateIndex
CREATE INDEX "public_family_members_user_id_idx" ON "public_family_members"("user_id");

-- CreateIndex
CREATE INDEX "public_family_members_family_id_idx" ON "public_family_members"("family_id");

-- CreateIndex
CREATE INDEX "public_family_members_created_at_idx" ON "public_family_members"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "public_family_members_user_id_family_id_key" ON "public_family_members"("user_id", "family_id");

-- CreateIndex
CREATE INDEX "public_scan_records_member_id_idx" ON "public_scan_records"("member_id");

-- CreateIndex
CREATE INDEX "public_scan_records_category_id_idx" ON "public_scan_records"("category_id");

-- CreateIndex
CREATE INDEX "public_scan_records_created_at_idx" ON "public_scan_records"("created_at");

-- CreateIndex
CREATE INDEX "public_alerts_family_id_idx" ON "public_alerts"("family_id");

-- CreateIndex
CREATE INDEX "public_alerts_member_id_idx" ON "public_alerts"("member_id");

-- CreateIndex
CREATE INDEX "public_alerts_created_at_idx" ON "public_alerts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "public_child_profiles_member_id_key" ON "public_child_profiles"("member_id");

-- CreateIndex
CREATE INDEX "public_child_profiles_member_id_idx" ON "public_child_profiles"("member_id");

-- CreateIndex
CREATE INDEX "public_child_safety_alerts_child_profile_id_idx" ON "public_child_safety_alerts"("child_profile_id");

-- CreateIndex
CREATE INDEX "public_child_safety_alerts_member_id_idx" ON "public_child_safety_alerts"("member_id");

-- CreateIndex
CREATE INDEX "public_location_shares_member_id_idx" ON "public_location_shares"("member_id");

-- CreateIndex
CREATE INDEX "public_location_shares_created_at_idx" ON "public_location_shares"("created_at");

-- CreateIndex
CREATE INDEX "public_incidents_member_id_idx" ON "public_incidents"("member_id");

-- CreateIndex
CREATE INDEX "public_incidents_created_at_idx" ON "public_incidents"("created_at");

-- CreateIndex
CREATE INDEX "public_chat_messages_member_id_idx" ON "public_chat_messages"("member_id");

-- CreateIndex
CREATE INDEX "public_chat_messages_created_at_idx" ON "public_chat_messages"("created_at");

-- CreateIndex
CREATE INDEX "public_emergency_sos_events_member_id_idx" ON "public_emergency_sos_events"("member_id");

-- CreateIndex
CREATE INDEX "public_emergency_sos_events_created_at_idx" ON "public_emergency_sos_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_relationships_invite_token_key" ON "guardian_relationships"("invite_token");

-- CreateIndex
CREATE INDEX "guardian_relationships_guardian_id_idx" ON "guardian_relationships"("guardian_id");

-- CreateIndex
CREATE INDEX "guardian_relationships_user_id_idx" ON "guardian_relationships"("user_id");

-- CreateIndex
CREATE INDEX "guardian_relationships_created_at_idx" ON "guardian_relationships"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_relationships_guardian_id_user_id_key" ON "guardian_relationships"("guardian_id", "user_id");

-- CreateIndex
CREATE INDEX "safety_sessions_user_id_idx" ON "safety_sessions"("user_id");

-- CreateIndex
CREATE INDEX "check_ins_session_id_idx" ON "check_ins"("session_id");

-- CreateIndex
CREATE INDEX "sos_events_user_id_idx" ON "sos_events"("user_id");

-- CreateIndex
CREATE INDEX "sos_events_created_at_idx" ON "sos_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_alerts_sos_event_id_key" ON "guardian_alerts"("sos_event_id");

-- CreateIndex
CREATE INDEX "guardian_alerts_user_id_idx" ON "guardian_alerts"("user_id");

-- CreateIndex
CREATE INDEX "guardian_alerts_session_id_idx" ON "guardian_alerts"("session_id");

-- CreateIndex
CREATE INDEX "guardian_alerts_sos_event_id_idx" ON "guardian_alerts"("sos_event_id");

-- CreateIndex
CREATE INDEX "guardian_alerts_created_at_idx" ON "guardian_alerts"("created_at");

-- CreateIndex
CREATE INDEX "alert_recipients_alert_id_idx" ON "alert_recipients"("alert_id");

-- CreateIndex
CREATE INDEX "alert_recipients_guardian_id_idx" ON "alert_recipients"("guardian_id");

-- CreateIndex
CREATE UNIQUE INDEX "alert_recipients_alert_id_guardian_id_key" ON "alert_recipients"("alert_id", "guardian_id");

-- CreateIndex
CREATE INDEX "location_pings_session_id_idx" ON "location_pings"("session_id");

-- CreateIndex
CREATE INDEX "location_pings_created_at_idx" ON "location_pings"("created_at");

-- CreateIndex
CREATE INDEX "guardian_audit_logs_guardian_id_idx" ON "guardian_audit_logs"("guardian_id");

-- CreateIndex
CREATE INDEX "guardian_audit_logs_user_id_idx" ON "guardian_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "guardian_audit_logs_created_at_idx" ON "guardian_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "threat_categories_slug_key" ON "threat_categories"("slug");

-- CreateIndex
CREATE INDEX "threat_categories_parent_id_idx" ON "threat_categories"("parent_id");

-- CreateIndex
CREATE INDEX "threat_categories_slug_idx" ON "threat_categories"("slug");

-- CreateIndex
CREATE INDEX "threat_categories_created_at_idx" ON "threat_categories"("created_at");

-- CreateIndex
CREATE INDEX "threat_indicators_type_value_idx" ON "threat_indicators"("type", "value");

-- CreateIndex
CREATE INDEX "threat_indicators_category_id_idx" ON "threat_indicators"("category_id");

-- CreateIndex
CREATE INDEX "threat_indicators_created_at_idx" ON "threat_indicators"("created_at");

-- CreateIndex
CREATE INDEX "url_analyses_domain_idx" ON "url_analyses"("domain");

-- CreateIndex
CREATE INDEX "url_analyses_analyzed_at_idx" ON "url_analyses"("analyzed_at");

-- CreateIndex
CREATE INDEX "qr_scans_member_id_idx" ON "qr_scans"("member_id");

-- CreateIndex
CREATE INDEX "qr_scans_created_at_idx" ON "qr_scans"("created_at");

-- CreateIndex
CREATE INDEX "qr_scans_url_analysis_id_idx" ON "qr_scans"("url_analysis_id");

-- CreateIndex
CREATE INDEX "model_runs_provider_idx" ON "model_runs"("provider");

-- CreateIndex
CREATE INDEX "model_runs_created_at_idx" ON "model_runs"("created_at");

-- CreateIndex
CREATE INDEX "model_runs_scan_record_id_idx" ON "model_runs"("scan_record_id");

-- CreateIndex
CREATE INDEX "model_feedback_scan_record_id_idx" ON "model_feedback"("scan_record_id");

-- CreateIndex
CREATE INDEX "model_feedback_feedback_idx" ON "model_feedback"("feedback");

-- CreateIndex
CREATE INDEX "model_feedback_created_at_idx" ON "model_feedback"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "emergency_contacts_user_id_idx" ON "emergency_contacts"("user_id");

-- CreateIndex
CREATE INDEX "emergency_contacts_created_at_idx" ON "emergency_contacts"("created_at");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_channel_category_key" ON "notification_preferences"("user_id", "channel", "category");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_created_at_idx" ON "admin_users"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_id_idx" ON "admin_audit_logs"("admin_id");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "security_events_event_type_idx" ON "security_events"("event_type");

-- CreateIndex
CREATE INDEX "security_events_severity_idx" ON "security_events"("severity");

-- CreateIndex
CREATE INDEX "security_events_created_at_idx" ON "security_events"("created_at");

-- CreateIndex
CREATE INDEX "security_events_user_id_idx" ON "security_events"("user_id");

-- CreateIndex
CREATE INDEX "system_metrics_metric_key_period_idx" ON "system_metrics"("metric_key", "period");

-- CreateIndex
CREATE INDEX "system_metrics_recorded_at_idx" ON "system_metrics"("recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_created_at_idx" ON "sessions"("created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_families" ADD CONSTRAINT "public_families_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_family_members" ADD CONSTRAINT "public_family_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_family_members" ADD CONSTRAINT "public_family_members_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_scan_records" ADD CONSTRAINT "public_scan_records_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "threat_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_scan_records" ADD CONSTRAINT "public_scan_records_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public_family_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_alerts" ADD CONSTRAINT "public_alerts_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "public_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_alerts" ADD CONSTRAINT "public_alerts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public_family_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_child_profiles" ADD CONSTRAINT "public_child_profiles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public_family_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_child_safety_alerts" ADD CONSTRAINT "public_child_safety_alerts_child_profile_id_fkey" FOREIGN KEY ("child_profile_id") REFERENCES "public_child_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_child_safety_alerts" ADD CONSTRAINT "public_child_safety_alerts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public_family_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_location_shares" ADD CONSTRAINT "public_location_shares_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public_family_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_incidents" ADD CONSTRAINT "public_incidents_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public_family_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_chat_messages" ADD CONSTRAINT "public_chat_messages_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public_family_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_emergency_sos_events" ADD CONSTRAINT "public_emergency_sos_events_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public_family_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_relationships" ADD CONSTRAINT "guardian_relationships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_sessions" ADD CONSTRAINT "safety_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "safety_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sos_events" ADD CONSTRAINT "sos_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_alerts" ADD CONSTRAINT "guardian_alerts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "safety_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_alerts" ADD CONSTRAINT "guardian_alerts_sos_event_id_fkey" FOREIGN KEY ("sos_event_id") REFERENCES "sos_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_alerts" ADD CONSTRAINT "guardian_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_recipients" ADD CONSTRAINT "alert_recipients_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "guardian_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_recipients" ADD CONSTRAINT "alert_recipients_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "safety_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_audit_logs" ADD CONSTRAINT "guardian_audit_logs_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_audit_logs" ADD CONSTRAINT "guardian_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threat_categories" ADD CONSTRAINT "threat_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "threat_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threat_indicators" ADD CONSTRAINT "threat_indicators_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "threat_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_url_analysis_id_fkey" FOREIGN KEY ("url_analysis_id") REFERENCES "url_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
