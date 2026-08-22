import re

with open('prisma/schema.prisma', 'r') as f:
    schema = f.read()

# 1. Switch datasource
schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"')

# 2. Replace IDs
schema = schema.replace('@id @default(cuid())', '@id @default(dbgenerated("gen_random_uuid()")) @db.Uuid')

# Update foreign keys to @db.Uuid
# Find all "String" or "String?" that are foreign keys. 
# We'll regex: (^\s*\w+Id\s+String\??)
schema = re.sub(r'(^\s*\w+Id\s+String\??)(?!.*@db\.Uuid)', r'\1 @db.Uuid', schema, flags=re.MULTILINE)

# Also fix id of RefreshToken: `token String @id` -> this isn't cuid. We keep it as is? Instruction says:
# "Replace @default(cuid()) with @default(dbgenerated("gen_random_uuid()")) and change type to String @db.Uuid for all id fields"
# RefreshToken has `token String @id`. I'll leave it.

# 3. Add updatedAt to mutable tables
# For each model, insert updatedAt before the first `@@` or at end
def add_fields(match):
    model_name = match.group(1)
    body = match.group(2)
    
    additions = []
    if 'updatedAt' not in body and model_name not in ['RefreshToken']:
        additions.append('  updatedAt DateTime? @updatedAt @map("updated_at")')
    if model_name in ['User', 'Family', 'FamilyMember', 'Incident']:
        additions.append('  deletedAt DateTime? @map("deleted_at")')
        
    # Also we need to add @@index for foreign keys and created_at
    # Find all foreign keys (fields ending with Id)
    fk_matches = re.findall(r'^\s*(\w+Id)\s+String', body, flags=re.MULTILINE)
    
    for fk in fk_matches:
        idx_str = f'@@index([{fk}])'
        if idx_str not in body:
            additions.append(f'  {idx_str}')
            
    if '@@index([createdAt])' not in body and 'createdAt' in body:
        additions.append('  @@index([createdAt])')

    if additions:
        if '@@' in body:
            idx = body.rfind('@@')
            # insert before the first @@ in the last block of @@
            # Actually, just insert before the last @@ block
            parts = body.split('@@')
            # Find first @@ index
            first_at = body.find('@@')
            body = body[:first_at] + '\n'.join(additions) + '\n  ' + body[first_at:]
        else:
            body = body + '\n' + '\n'.join(additions) + '\n'
            
    # For ScanRecord, add the new relation
    if model_name == 'ScanRecord':
        body = body.replace('@@map("public_scan_records")', 
                            'categoryId String? @map("category_id") @db.Uuid\n  threatCategory ThreatCategory? @relation("ScanCategory", fields: [categoryId], references: [id])\n  @@map("public_scan_records")')
    
    # For User, add sessions relation
    if model_name == 'User':
        body = body.replace('@@map("users")',
                            'sessions Session[]\n  @@map("users")')
                            
    return f'model {model_name} {{{body}}}'

schema = re.sub(r'model\s+(\w+)\s*\{([^}]+)\}', add_fields, schema)

new_models = """
model ThreatCategory {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  slug        String   @unique
  nameEn      String   @map("name_en")
  nameHi      String?  @map("name_hi")
  parentId    String?  @map("parent_id") @db.Uuid
  severity    String   @default("MEDIUM") // LOW, MEDIUM, HIGH, CRITICAL
  description String?
  version     Int      @default(1)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime? @updatedAt @map("updated_at")

  parent      ThreatCategory?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children    ThreatCategory[] @relation("CategoryHierarchy")
  indicators  ThreatIndicator[]
  scanResults ScanRecord[]     @relation("ScanCategory")

  @@index([parentId])
  @@index([slug])
  @@map("threat_categories")
}

model ThreatIndicator {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  type         String    // domain, ip, pattern, keyword, url
  value        String
  categoryId   String?   @map("category_id") @db.Uuid
  source       String    @default("manual") // manual, feed, community
  confidence   Float     @default(0.5)
  active       Boolean   @default(true)
  expiresAt    DateTime? @map("expires_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime? @updatedAt @map("updated_at")

  category ThreatCategory? @relation(fields: [categoryId], references: [id])

  @@index([type, value])
  @@index([categoryId])
  @@map("threat_indicators")
}

model UrlAnalysis {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  url             String
  domain          String?
  tld             String?
  hasSsl          Boolean? @map("has_ssl")
  domainAgeDays   Int?     @map("domain_age_days")
  redirectChain   String?  @map("redirect_chain") // JSON array
  riskScore       Int      @default(0) @map("risk_score")
  indicators      String?  // JSON array of detected indicators
  ssrfBlocked     Boolean  @default(false) @map("ssrf_blocked")
  analyzedAt      DateTime @default(now()) @map("analyzed_at")

  qrScans QrScan[]

  @@index([domain])
  @@index([analyzedAt])
  @@map("url_analyses")
}

model QrScan {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  memberId        String?  @map("member_id")
  decodedContent  String   @map("decoded_content")
  destinationType String   @map("destination_type") // url, upi, text, vcard
  urlAnalysisId   String?  @map("url_analysis_id") @db.Uuid
  riskScore       Int      @default(0) @map("risk_score")
  createdAt       DateTime @default(now()) @map("created_at")

  urlAnalysis UrlAnalysis? @relation(fields: [urlAnalysisId], references: [id])

  @@index([memberId])
  @@index([createdAt])
  @@map("qr_scans")
}

model ModelRun {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  provider      String   // gemini, openai, heuristic
  model         String   // gemini-1.5-flash, gpt-4o-mini, etc.
  promptHash    String   @map("prompt_hash") // SHA-256 of prompt (never store raw prompt)
  tokensIn      Int?     @map("tokens_in")
  tokensOut     Int?     @map("tokens_out")
  latencyMs     Int?     @map("latency_ms")
  costEstimate  Float?   @map("cost_estimate")
  success       Boolean  @default(true)
  error         String?
  scanRecordId  String?  @map("scan_record_id")
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([provider])
  @@index([createdAt])
  @@map("model_runs")
}

model ModelFeedback {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  scanRecordId String   @map("scan_record_id")
  feedback     String   // accurate, false_positive, false_negative
  userComment  String?  @map("user_comment")
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([scanRecordId])
  @@index([feedback])
  @@map("model_feedback")
}

model FeatureFlag {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  key         String    @unique
  enabled     Boolean   @default(false)
  description String?
  updatedAt   DateTime? @updatedAt @map("updated_at")

  @@map("feature_flags")
}

model EmergencyContact {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  name         String
  phone        String
  relationship String?
  priority     Int      @default(0)
  isVerified   Boolean  @default(false) @map("is_verified")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime? @updatedAt @map("updated_at")

  @@index([userId])
  @@map("emergency_contacts")
}

model NotificationPreference {
  id       String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId   String  @map("user_id") @db.Uuid
  channel  String  // push, sms, email
  category String  // security_alert, family_alert, scan_result, system
  enabled  Boolean @default(true)

  @@unique([userId, channel, category])
  @@map("notification_preferences")
}

model AdminUser {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email        String    @unique
  passwordHash String    @map("password_hash")
  mfaSecret    String?   @map("mfa_secret")
  mfaEnabled   Boolean   @default(false) @map("mfa_enabled")
  role         String    @default("analyst") // analyst, operator, admin, superadmin
  isActive     Boolean   @default(true) @map("is_active")
  lastLoginAt  DateTime? @map("last_login_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime? @updatedAt @map("updated_at")

  auditLogs AdminAuditLog[]

  @@map("admin_users")
}

model AdminAuditLog {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  adminId     String   @map("admin_id") @db.Uuid
  action      String   // login, view_user, modify_config, etc.
  resource    String?  // resource type affected
  resourceId  String?  @map("resource_id")
  details     String?  // JSON details
  ipAddress   String?  @map("ip_address")
  createdAt   DateTime @default(now()) @map("created_at")

  admin AdminUser @relation(fields: [adminId], references: [id])

  @@index([adminId])
  @@index([createdAt])
  @@map("admin_audit_logs")
}

model SecurityEvent {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  eventType  String   @map("event_type") // auth_attack, rate_limit_hit, ssrf_blocked, etc.
  severity   String   // info, warning, error, critical
  sourceIp   String?  @map("source_ip")
  userId     String?  @map("user_id") @db.Uuid
  details    String?  // JSON details
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([eventType])
  @@index([severity])
  @@index([createdAt])
  @@map("security_events")
}

model SystemMetric {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  metricKey  String   @map("metric_key") // total_scans, threats_detected, etc.
  value      Float
  period     String   // hourly, daily, weekly, monthly
  recordedAt DateTime @map("recorded_at")

  @@index([metricKey, period])
  @@index([recordedAt])
  @@map("system_metrics")
}

model Session {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  token        String   @unique
  ipAddress    String?  @map("ip_address")
  userAgent    String?  @map("user_agent")
  lastActiveAt DateTime @default(now()) @map("last_active_at")
  expiresAt    DateTime @map("expires_at")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime? @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
  @@map("sessions")
}
"""

schema += "\n" + new_models

with open('prisma/schema.prisma', 'w', encoding='utf-8') as f:
    f.write(schema)
