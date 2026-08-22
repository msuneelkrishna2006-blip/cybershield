const fs = require('fs');

let schema = fs.readFileSync('prisma/schema.prisma', 'utf-8');

// 1. replace sqlite with postgresql
schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');

// 2. replace id fields
schema = schema.replace(/id\s+String\s+@id\s+@default\(cuid\(\)\)/g, 'id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid');

// 3. Foreign key types and indexes. I will use a regex to find all relation fields that end with 'Id' and make them @db.Uuid
// Since there are specific ones, let's just do it manually in the string

// Let's replace the whole file since it's only 413 lines and I know exactly what needs to be changed.
