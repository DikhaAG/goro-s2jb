import { router } from "../trpc";
import { healthRouter } from "./health";
import { masterRouter } from "./master";
import { authRouter } from "./auth";
import { intakeRouter } from "./intake";
import { migrationRouter } from "./migration";
import { triageRouter } from "./triage";
import { reportRouter } from "./report";
import { userRouter } from "./user";
import { systemProcessesRouter } from "./systemProcesses";

export const appRouter = router({
  health: healthRouter,
  master: masterRouter,
  auth: authRouter,
  user: userRouter,
  intake: intakeRouter,
  migration: migrationRouter,
  triage: triageRouter,
  report: reportRouter,
  systemProcesses: systemProcessesRouter,
});

export type AppRouter = typeof appRouter;
