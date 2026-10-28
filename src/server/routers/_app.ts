import { router } from "../trpc";
import { healthRouter } from "./health";
import { masterRouter } from "./master";
import { authRouter } from "./auth";
import { intakeRouter } from "./intake";
import { migrationRouter } from "./migration";

export const appRouter = router({
  health: healthRouter,
  master: masterRouter,
  auth: authRouter,
  intake: intakeRouter,
  migration: migrationRouter,
});

export type AppRouter = typeof appRouter;
