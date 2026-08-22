import re

with open('prisma/schema.prisma', 'r', encoding='utf-8') as f:
    schema = f.read()

# 1. Switch to PostgreSQL
schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"')

# 2. Replace id fields
schema = re.sub(r'id\s+String\s+@id\s+@default\(cuid\(\)\)', r'id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid', schema)

# 3. Add @db.Uuid to all foreign keys that map to ID
# Any String field ending with Id or _id, let's find them
# Fields like: userId String @map("user_id") -> userId String @map("user_id") @db.Uuid
# Let's do a manual map of fields to change to @db.Uuid:
fk_fields = [
    'userId', 'ownerId', 'familyId', 'memberId', 'childProfileId', 
    'guardianId', 'sessionId', 'sosEventId', 'alertId'
]
for fk in fk_fields:
    # Match lines like "  userId    String" or "  userId    String?"
    schema = re.sub(fr'(\b{fk}\b\s+String\??\s*)', r'\1 @db.Uuid ', schema)

# Fix double @db.Uuid just in case
schema = schema.replace('@db.Uuid @db.Uuid', '@db.Uuid')

# Add updatedAt to models
# Models that need updatedAt: User, Otp, SupportTicket, Family, FamilyMember, ScanRecord, FamilyAlert, ChildProfile, ChildSafetyAlert, LocationShare, Incident, ChatMessage, EmergencySosEvent, GuardianRelationship, SafetySession, CheckIn, SOSEvent, GuardianAlert, AlertRecipient, LocationPing, GuardianAuditLog
def add_updatedAt(match):
    body = match.group(2)
    # Check if updatedAt is already there
    if 'updatedAt' not in body:
        # insert before the relations or @@
        insert_pos = body.find('@@')
        if insert_pos == -1:
            insert_pos = len(body)
        body = body[:insert_pos] + "  updatedAt DateTime? @updatedAt @map(\"updated_at\")\n  " + body[insert_pos:]
    return "model " + match.group(1) + " {" + body + "}"

# We will apply this dynamically later, actually let's just do it manually for the ones that don't have it.
# Actually I'll write a full new schema directly.
