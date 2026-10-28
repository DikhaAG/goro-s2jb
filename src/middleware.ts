/**
 * Runtime Adapter: Delegates edge interception to the modern Next.js Edge Proxy (src/proxy.ts).
 * This ensures 100% backward compatibility with Next.js 15 while adopting Next.js 16+ proxy conventions.
 */
import { proxy, config } from "./proxy";

export { proxy as middleware, config };
