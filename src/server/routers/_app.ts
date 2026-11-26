import { router } from "../trpc";
import { masterRouter } from "./master";
import { authRouter } from "./auth";
import { intakeRouter } from "./intake";
import { migrationRouter } from "./migration";
import { reportRouter } from "./report";
import { userRouter } from "./user";
import { systemProcessesRouter } from "./systemProcesses";
import { reviewsRouter } from "./reviews";

export const appRouter = router({
  master: masterRouter,
  auth: authRouter,
  user: userRouter,
  intake: intakeRouter,
  migration: migrationRouter,
  report: reportRouter,
  systemProcesses: systemProcessesRouter,
  reviews: reviewsRouter,
});

export type AppRouter = typeof appRouter;
