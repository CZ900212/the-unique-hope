import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const runtimeNodeEnv = process.env.NODE_ENV ?? "development";
const runtimeMaxUploadMb = process.env.MAX_UPLOAD_MB ?? "5";
const runtimePasswordResetTokenTtlMinutes =
  process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ?? "60";
const runtimeRateLimitHashKey =
  runtimeNodeEnv === "production"
    ? process.env.RATE_LIMIT_HASH_KEY
    : (process.env.RATE_LIMIT_HASH_KEY ?? "local-rate-limit-key");

export const env = createEnv({
  server: {
    AUTH_URL: z.string().url().optional(),
    AUTH_SECRET:
      runtimeNodeEnv === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    AUTH_TRUST_HOST: z.enum(["true", "false"]).optional(),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    DATABASE_URL: z.string().url(),
    LESSON_EVIDENCE_LOCAL_DIR: z.string().optional(),
    LESSON_EVIDENCE_STORAGE: z.enum(["blob", "local"]).optional(),
    MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PASSWORD_RESET_FROM_EMAIL: z.string().email().optional(),
    PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(5)
      .max(1440)
      .default(60),
    RATE_LIMIT_HASH_KEY:
      runtimeNodeEnv === "production"
        ? z.string().min(32).optional()
        : z.string().min(1).default("local-rate-limit-key"),
    RATE_LIMIT_TRUST_FORWARD_HEADERS: z.enum(["true", "false"]).optional(),
    RECOVERY_PHONE_HASH_KEY:
      runtimeNodeEnv === "production"
        ? z.string().min(32).optional()
        : z.string().min(1).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_NAME: z.string().min(1).optional(),
    SEED_ADMIN_PASSWORD: z.string().min(6).optional(),
    SEED_RESET_EXISTING_PASSWORDS: z.enum(["true", "false"]).optional(),
    SEED_ADMIN_USERNAME: z.string().min(3).optional(),
    SEED_DEMO_DATA: z.enum(["true", "false"]).optional(),
    TENCENTCLOUD_SECRET_ID: z.string().min(1).optional(),
    TENCENTCLOUD_SECRET_KEY: z.string().min(1).optional(),
    TENCENT_SMS_REGION: z.string().min(1).default("ap-guangzhou"),
    TENCENT_SMS_SDK_APP_ID: z.string().min(1).optional(),
    TENCENT_SMS_SIGN_NAME: z.string().min(1).optional(),
    TENCENT_SMS_TEMPLATE_ID_PASSWORD_RESET: z.string().min(1).optional(),
    VERCEL_BLOB_READ_WRITE_TOKEN: z.string().optional(),
    WEB_PUSH_DRAIN_SECRET:
      runtimeNodeEnv === "production"
        ? z.string().min(32).optional()
        : z.string().min(1).optional(),
    WEB_PUSH_ENABLED: z.enum(["true", "false"]).optional(),
    WEB_PUSH_PRIVATE_KEY: z.string().min(1).optional(),
    WEB_PUSH_SUBJECT: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["en", "zh"]),
    NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: z.string().optional(),
  },
  runtimeEnv: {
    AUTH_URL: process.env.AUTH_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    DATABASE_URL: process.env.DATABASE_URL,
    LESSON_EVIDENCE_LOCAL_DIR: process.env.LESSON_EVIDENCE_LOCAL_DIR,
    LESSON_EVIDENCE_STORAGE: process.env.LESSON_EVIDENCE_STORAGE,
    MAX_UPLOAD_MB: runtimeMaxUploadMb,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY,
    NODE_ENV: runtimeNodeEnv,
    PASSWORD_RESET_FROM_EMAIL: process.env.PASSWORD_RESET_FROM_EMAIL,
    PASSWORD_RESET_TOKEN_TTL_MINUTES: runtimePasswordResetTokenTtlMinutes,
    RATE_LIMIT_HASH_KEY: runtimeRateLimitHashKey,
    RATE_LIMIT_TRUST_FORWARD_HEADERS:
      process.env.RATE_LIMIT_TRUST_FORWARD_HEADERS,
    RECOVERY_PHONE_HASH_KEY: process.env.RECOVERY_PHONE_HASH_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
    SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME,
    SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
    SEED_RESET_EXISTING_PASSWORDS: process.env.SEED_RESET_EXISTING_PASSWORDS,
    SEED_ADMIN_USERNAME: process.env.SEED_ADMIN_USERNAME,
    SEED_DEMO_DATA: process.env.SEED_DEMO_DATA,
    TENCENTCLOUD_SECRET_ID: process.env.TENCENTCLOUD_SECRET_ID,
    TENCENTCLOUD_SECRET_KEY: process.env.TENCENTCLOUD_SECRET_KEY,
    TENCENT_SMS_REGION: process.env.TENCENT_SMS_REGION,
    TENCENT_SMS_SDK_APP_ID: process.env.TENCENT_SMS_SDK_APP_ID,
    TENCENT_SMS_SIGN_NAME: process.env.TENCENT_SMS_SIGN_NAME,
    TENCENT_SMS_TEMPLATE_ID_PASSWORD_RESET:
      process.env.TENCENT_SMS_TEMPLATE_ID_PASSWORD_RESET,
    VERCEL_BLOB_READ_WRITE_TOKEN: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    WEB_PUSH_DRAIN_SECRET: process.env.WEB_PUSH_DRAIN_SECRET,
    WEB_PUSH_ENABLED: process.env.WEB_PUSH_ENABLED,
    WEB_PUSH_PRIVATE_KEY: process.env.WEB_PUSH_PRIVATE_KEY,
    WEB_PUSH_SUBJECT: process.env.WEB_PUSH_SUBJECT,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
