import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5004),
  POSTGRES_URL: z.string().min(1),
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
  const parsed = envSchema.safeParse(Bun.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return parsed.data;
}

export const env = loadEnv();
