import { Hono } from "hono";
import type { AppEnv } from "../types/hono";

export const metaRoutes = new Hono<AppEnv>();

metaRoutes.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "Fragstack-backend",
    timestamp: new Date().toISOString(),
  });
});
