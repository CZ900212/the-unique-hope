import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    AUTH_TRUST_HOST: z.enum(["true", "false"]).optional(),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    DATABASE_URL: z.string().url(),
    INSTANT_APP_ID: z.string().optional(),
    INSTANT_ADMIN_TOKEN: z.string().optional(),
    MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PASSWORD_RESET_FROM_EMAIL: z.string().email().optional(),
    PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
    RATE_LIMIT_TRUST_FORWARD_HEADERS: z.enum(["true", "false"]).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_NAME: z.string().min(1).optional(),
    SEED_ADMIN_PASSWORD: z.string().min(6).optional(),
    SEED_RESET_EXISTING_PASSWORDS: z.enum(["true", "false"]).optional(),
    SEED_ADMIN_USERNAME: z.string().min(3).optional(),
    SEED_DEMO_DATA: z.enum(["true", "false"]).optional(),
    VERCEL_BLOB_READ_WRITE_TOKEN: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["en", "zh"]),
  },
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    DATABASE_URL: process.env.DATABASE_URL,
    INSTANT_APP_ID: process.env.INSTANT_APP_ID,
    INSTANT_ADMIN_TOKEN: process.env.INSTANT_ADMIN_TOKEN,
    MAX_UPLOAD_MB: process.env.MAX_UPLOAD_MB,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NODE_ENV: process.env.NODE_ENV,
    PASSWORD_RESET_FROM_EMAIL: process.env.PASSWORD_RESET_FROM_EMAIL,
    PASSWORD_RESET_TOKEN_TTL_MINUTES: process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES,
    RATE_LIMIT_TRUST_FORWARD_HEADERS: process.env.RATE_LIMIT_TRUST_FORWARD_HEADERS,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
    SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME,
    SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
    SEED_RESET_EXISTING_PASSWORDS: process.env.SEED_RESET_EXISTING_PASSWORDS,
    SEED_ADMIN_USERNAME: process.env.SEED_ADMIN_USERNAME,
    SEED_DEMO_DATA: process.env.SEED_DEMO_DATA,
    VERCEL_BLOB_READ_WRITE_TOKEN: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
