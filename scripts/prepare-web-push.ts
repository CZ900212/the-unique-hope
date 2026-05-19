import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";
import type * as WebPush from "web-push";

const require = createRequire(import.meta.url);
const webPush = require("web-push") as typeof WebPush;

const PRODUCTION_APP_URL = "https://uniquehopeclub.com";
const DEFAULT_SUBJECT = "mailto:admin@theuniquehope.org";
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const REQUIRED_FILES = [
  "public/notification-sw.js",
  "src/app/api/notifications/push/drain/route.ts",
  "src/server/services/notification-push.ts",
  "src/server/services/notifications.ts",
  "src/server/api/routers/notifications.ts",
  "drizzle/0005_real_calendar_notifications.sql",
  "drizzle/0006_web_push_delivery_outbox.sql",
] as const;

const WEB_PUSH_TABLES = [
  "unique_hope_user_notification",
  "unique_hope_browser_push_subscription",
  "unique_hope_notification_push_delivery",
] as const;

type CheckStatus = "fail" | "ok" | "warn";

type CheckResult = {
  detail?: string;
  status: CheckStatus;
  title: string;
};

type Options = {
  check: boolean;
  production: boolean;
  requireDb: boolean;
  subject: string;
};

type SchemaRow = {
  exists: boolean;
};

function parseOptions(): Options {
  return {
    check: hasFlag("--check"),
    production: hasFlag("--production"),
    requireDb: hasFlag("--require-db"),
    subject: readArg("--subject") ?? DEFAULT_SUBJECT,
  };
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function readArg(flag: string) {
  const index = process.argv.findIndex((value) => value === flag);
  const value = index >= 0 ? process.argv[index + 1]?.trim() : null;
  return value && !value.startsWith("--") ? value : null;
}

async function main() {
  const options = parseOptions();

  if (options.check) {
    await runReadinessCheck(options);
    return;
  }

  printGeneratedValues(options.subject);
}

function printGeneratedValues(subject: string) {
  const vapid = webPush.generateVAPIDKeys();
  const drainSecret = randomBytes(48).toString("base64url");

  console.log("Generated Web Push production values.");
  console.log(
    "Keep WEB_PUSH_ENABLED=false until schema and drain checks pass.",
  );
  console.log("");
  console.log(`NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY="${vapid.publicKey}"`);
  console.log(`WEB_PUSH_PRIVATE_KEY="${vapid.privateKey}"`);
  console.log(`WEB_PUSH_SUBJECT="${subject}"`);
  console.log('WEB_PUSH_ENABLED="false"');
  console.log(`WEB_PUSH_DRAIN_SECRET="${drainSecret}"`);
  console.log("");
  console.log("After adding these to the server environment, run:");
  console.log("npm run web-push:check:production");
}

async function runReadinessCheck(options: Options) {
  const results: CheckResult[] = [
    ...checkRepoFiles(),
    ...checkEnvironment(options),
  ];

  results.push(...(await checkDatabaseSchema(options)));
  printResults(results);

  if (results.some((result) => result.status === "fail")) {
    process.exitCode = 1;
  }
}

function checkRepoFiles(): CheckResult[] {
  return REQUIRED_FILES.map((relativePath) => {
    const exists = existsSync(path.join(REPO_ROOT, relativePath));
    return {
      detail: relativePath,
      status: exists ? "ok" : "fail",
      title: exists ? "Required file exists" : "Required file is missing",
    };
  });
}

function checkEnvironment(options: Options): CheckResult[] {
  const results: CheckResult[] = [];
  const webPushEnabled = process.env.WEB_PUSH_ENABLED;
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;
  const drainSecret = process.env.WEB_PUSH_DRAIN_SECRET;
  const pushDisabledForPrep = webPushEnabled === "false";
  const pushEnabledEarly = webPushEnabled === "true";

  results.push({
    detail: `WEB_PUSH_ENABLED=${webPushEnabled ?? "(unset)"}`,
    status: options.production
      ? pushDisabledForPrep
        ? "ok"
        : "fail"
      : pushEnabledEarly
        ? "warn"
        : "ok",
    title:
      options.production && !pushDisabledForPrep
        ? "WEB_PUSH_ENABLED must stay false for prep"
        : pushEnabledEarly
          ? "Web Push is already enabled"
          : "Web Push remains disabled for prep",
  });

  results.push(
    requireEnvValue("NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY", publicKey, options),
    requireEnvValue("WEB_PUSH_PRIVATE_KEY", privateKey, options),
    requireEnvValue("WEB_PUSH_SUBJECT", subject, options),
    requireEnvValue("WEB_PUSH_DRAIN_SECRET", drainSecret, options, 32),
  );

  if (options.production) {
    results.push(
      requireExactEnvValue("AUTH_URL", process.env.AUTH_URL),
      requireExactEnvValue(
        "NEXT_PUBLIC_APP_URL",
        process.env.NEXT_PUBLIC_APP_URL,
      ),
    );
  }

  return results;
}

function requireEnvValue(
  name: string,
  value: string | undefined,
  options: Options,
  minLength = 1,
): CheckResult {
  const configured = typeof value === "string" && value.length >= minLength;
  const required =
    options.production || process.env.WEB_PUSH_ENABLED === "true";

  return {
    detail: configured ? name : `${name} is empty`,
    status: configured ? "ok" : required ? "fail" : "warn",
    title: configured
      ? `${name} configured`
      : required
        ? `${name} must be configured`
        : `${name} not configured yet`,
  };
}

function requireExactEnvValue(
  name: string,
  value: string | undefined,
): CheckResult {
  const matches = value === PRODUCTION_APP_URL;
  return {
    detail: `${name}=${value ?? "(unset)"}`,
    status: matches ? "ok" : "fail",
    title: matches
      ? `${name} points to production`
      : `${name} must be ${PRODUCTION_APP_URL}`,
  };
}

async function checkDatabaseSchema(options: Options): Promise<CheckResult[]> {
  const databaseUrl = process.env.DATABASE_URL;
  const dbRequired = options.requireDb || options.production;

  if (!databaseUrl) {
    return [
      {
        detail: "DATABASE_URL is empty",
        status: dbRequired ? "fail" : "warn",
        title: dbRequired
          ? "Database check cannot run"
          : "Database check skipped",
      },
    ];
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const results: CheckResult[] = [];

  try {
    for (const tableName of WEB_PUSH_TABLES) {
      const rows = await sql<SchemaRow[]>`
        SELECT to_regclass(${`public.${tableName}`}) IS NOT NULL AS "exists"
      `;
      const exists = rows[0]?.exists === true;
      results.push({
        detail: tableName,
        status: exists ? "ok" : "fail",
        title: exists
          ? "Notification table exists"
          : "Notification table is missing",
      });
    }
  } catch (error) {
    results.push({
      detail: error instanceof Error ? error.message : String(error),
      status: dbRequired ? "fail" : "warn",
      title: dbRequired
        ? "Database schema check failed"
        : "Database schema check skipped after connection failure",
    });
  } finally {
    await sql.end({ timeout: 5 });
  }

  return results;
}

function printResults(results: CheckResult[]) {
  for (const result of results) {
    const marker =
      result.status === "ok"
        ? "OK"
        : result.status === "warn"
          ? "WARN"
          : "FAIL";
    console.log(`[${marker}] ${result.title}`);
    if (result.detail) {
      console.log(`       ${result.detail}`);
    }
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
