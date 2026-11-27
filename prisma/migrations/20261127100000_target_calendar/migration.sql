-- Kalender Target replaces per-ULP TargetMaster (ADR-0002)
DROP TABLE "TargetMaster";

CREATE TABLE "TargetCalendarEntry" (
    "date" DATE NOT NULL,
    "dailyTarget" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetCalendarEntry_pkey" PRIMARY KEY ("date")
);
