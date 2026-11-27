-- better-auth reads credential passwords from "Account" (providerId 'credential',
-- accountId = userId). Before this migration the custom login route read
-- "User"."passwordHash", and password resets only updated that column, so it
-- is the authoritative copy and overwrites any drifted "Account"."password".

-- 1. Credential accounts created with accountId = username are re-keyed by user id.
UPDATE "Account"
SET "accountId" = "userId", "updatedAt" = CURRENT_TIMESTAMP
WHERE "providerId" = 'credential' AND "accountId" <> "userId";

-- 2. Copy the authoritative hash into existing credential accounts.
UPDATE "Account" AS a
SET "password" = u."passwordHash", "updatedAt" = CURRENT_TIMESTAMP
FROM "User" AS u
WHERE a."userId" = u."id"
  AND a."providerId" = 'credential'
  AND u."passwordHash" IS NOT NULL
  AND a."password" IS DISTINCT FROM u."passwordHash";

-- 3. Users with a hash but no credential account get one.
INSERT INTO "Account" ("id", "userId", "accountId", "providerId", "password", "createdAt", "updatedAt")
SELECT 'acc_' || u."id", u."id", u."id", 'credential', u."passwordHash", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" AS u
WHERE u."passwordHash" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Account" AS a WHERE a."userId" = u."id" AND a."providerId" = 'credential'
  );

-- 4. "Account" is now the only copy.
ALTER TABLE "User" DROP COLUMN "passwordHash";
