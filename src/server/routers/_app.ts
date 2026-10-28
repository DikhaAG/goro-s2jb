import { router } from "../trpc";
import { healthRouter } from "./health";
import { masterRouter } from "./master";
import { authRouter } from "./auth";

export const appRouter = router({
  health: healthRouter,
  master: masterRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
