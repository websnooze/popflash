import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/** Bun loads `.env` from cwd; with `--hot`, also load backend `.env` next to package.json. */
function readEnvFromFile(): Record<string, string> {
  const envPath = join(import.meta.dir, "../../.env");
  if (!existsSync(envPath)) return {};

  const out: Record<string, string> = {};
  const content = readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }

  return out;
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5004),
  POSTGRES_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  PUBLIC_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  STEAM_API_KEY: z.string().min(1),
  DATHOST_EMAIL: z.string().email(),
  DATHOST_PASSWORD: z.string().min(1),
  DATHOST_TEMPLATE_SERVER_ID: z.string().min(1),
  DATHOST_WEBHOOK_SECRET: z.string().min(16),
  COOKIE_NAME: z.string().default("fragstack_session"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse({
    ...readEnvFromFile(),
    ...Bun.env,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return parsed.data;
}

export const env = loadEnv();
