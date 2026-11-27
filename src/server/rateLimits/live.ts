import redis from "@/lib/redis";
import { createRateLimits } from "./index";

export const rateLimits = createRateLimits({ redis });
