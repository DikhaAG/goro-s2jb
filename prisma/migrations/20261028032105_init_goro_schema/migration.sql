-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PETUGAS_LAPANGAN', 'PEGAWAI', 'MANAGER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PETUGAS_LAPANGAN',
    "up3Id" TEXT,
    "ulpId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UP3" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UP3_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ULP" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "up3Id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ULP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetMaster" (
    "id" TEXT NOT NULL,
    "ulpId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "dailyTarget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cumulativeTarget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingReview" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "up3Id" TEXT NOT NULL,
    "ulpId" TEXT NOT NULL,
    "playstoreReviewerName" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "evidenceImagePath" TEXT NOT NULL,
    "evidenceImageHash" TEXT,
    "appVersionId" TEXT NOT NULL,
    "originalReviewerName" TEXT,
    "reviewerCategory" TEXT NOT NULL DEFAULT 'Pelanggan',
    "fieldNotes" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfId" TEXT,
    "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
    "confidenceScore" DOUBLE PRECISION,
    "extractedOcrText" TEXT,
    "reviewRemarks" TEXT,
    "submittedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatingReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UP3_code_key" ON "UP3"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ULP_code_key" ON "ULP"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AppVersion_version_key" ON "AppVersion"("version");

-- CreateIndex
CREATE INDEX "TargetMaster_targetDate_idx" ON "TargetMaster"("targetDate");

-- CreateIndex
CREATE INDEX "TargetMaster_ulpId_idx" ON "TargetMaster"("ulpId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetMaster_ulpId_targetDate_key" ON "TargetMaster"("ulpId", "targetDate");

-- CreateIndex
CREATE INDEX "RatingReview_timestamp_idx" ON "RatingReview"("timestamp");

-- CreateIndex
CREATE INDEX "RatingReview_entryDate_idx" ON "RatingReview"("entryDate");

-- CreateIndex
CREATE INDEX "RatingReview_ulpId_idx" ON "RatingReview"("ulpId");

-- CreateIndex
CREATE INDEX "RatingReview_validationStatus_idx" ON "RatingReview"("validationStatus");

-- CreateIndex
CREATE INDEX "RatingReview_evidenceImageHash_idx" ON "RatingReview"("evidenceImageHash");

-- CreateIndex
CREATE INDEX "RatingReview_isDuplicate_idx" ON "RatingReview"("isDuplicate");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_up3Id_fkey" FOREIGN KEY ("up3Id") REFERENCES "UP3"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_ulpId_fkey" FOREIGN KEY ("ulpId") REFERENCES "ULP"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ULP" ADD CONSTRAINT "ULP_up3Id_fkey" FOREIGN KEY ("up3Id") REFERENCES "UP3"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetMaster" ADD CONSTRAINT "TargetMaster_ulpId_fkey" FOREIGN KEY ("ulpId") REFERENCES "ULP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingReview" ADD CONSTRAINT "RatingReview_up3Id_fkey" FOREIGN KEY ("up3Id") REFERENCES "UP3"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingReview" ADD CONSTRAINT "RatingReview_ulpId_fkey" FOREIGN KEY ("ulpId") REFERENCES "ULP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingReview" ADD CONSTRAINT "RatingReview_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingReview" ADD CONSTRAINT "RatingReview_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "RatingReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingReview" ADD CONSTRAINT "RatingReview_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingReview" ADD CONSTRAINT "RatingReview_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
