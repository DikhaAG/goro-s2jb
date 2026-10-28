import prisma from "../src/lib/prisma";

async function main() {
  console.log("Starting Better Auth database schema backfill and credential migration...");

  // 1. Add columns to User table if not existing
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayUsername" TEXT;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT;
  `);

  // 2. Backfill email and displayUsername for existing users
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "email" = "username" || '@goro.pln.co.id'
    WHERE "email" IS NULL;

    UPDATE "User"
    SET "displayUsername" = "username"
    WHERE "displayUsername" IS NULL;
  `);

  // 3. Set NOT NULL and UNIQUE on User.email
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
  `);

  // 4. Create Session table if not exists
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Session" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "token" TEXT NOT NULL UNIQUE,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  // 5. Create Account table if not exists
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Account" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "password" TEXT,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" TIMESTAMP(3),
      "refreshTokenExpiresAt" TIMESTAMP(3),
      "scope" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  // 6. Create Verification table if not exists
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Verification" (
      "id" TEXT PRIMARY KEY,
      "identifier" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    );
  `);

  // 7. Migrate all user passwordHash into Account (providerId: 'credential')
  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} existing users to verify Account records...`);

  for (const user of users) {
    if (user.passwordHash) {
      // Check if account already exists
      const existingAccount = await prisma.account.findFirst({
        where: {
          userId: user.id,
          providerId: "credential",
        },
      });

      if (!existingAccount) {
        await prisma.account.create({
          data: {
            id: `acc_${user.id}`,
            userId: user.id,
            accountId: user.id,
            providerId: "credential",
            password: user.passwordHash,
          },
        });
        console.log(`Created credential Account for user: ${user.username} (${user.role})`);
      } else {
        // Sync password if different
        if (existingAccount.password !== user.passwordHash) {
          await prisma.account.update({
            where: { id: existingAccount.id },
            data: { password: user.passwordHash },
          });
          console.log(`Updated credential Account password for user: ${user.username}`);
        }
      }
    }
  }

  console.log("Migration to Better Auth tables completed successfully!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
