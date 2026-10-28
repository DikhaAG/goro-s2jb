import { router } from "../trpc";
import { healthRouter } from "./health";
import { masterRouter } from "./master";
import { authRouter } from "./auth";
import { intakeRouter } from "./intake";
import { migrationRouter } from "./migration";
import { triageRouter } from "./triage";

export const appRouter = router({
  health: healthRouter,
  master: masterRouter,
  auth: authRouter,
  intake: intakeRouter,
  migration: migrationRouter,
  triage: triageRouter,
});

export type AppRouter = typeof appRouter;
