import { defineConfig, devices } from "@playwright/test";

const sharedEnv =
  `AUTH_SECRET=playwright-test-secret AUTH_TRUST_HOST=true NEXT_PUBLIC_APP_NAME='The Unique Hope' NEXT_PUBLIC_APP_URL='http://127.0.0.1:3100' NEXT_PUBLIC_DEFAULT_LOCALE='en' BLOB_READ_WRITE_TOKEN='test-token' SEED_ADMIN_EMAIL='admin@theuniquehope.org' SEED_ADMIN_NAME='The Unique Hope Admin' SEED_ADMIN_PASSWORD='playwright-admin-secret-2026' SEED_ADMIN_USERNAME='admin' SEED_DEMO_DATA='true'`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      `bash ./scripts/prepare-playwright-db.sh && DATABASE_URL=$(cat .playwright-database-url) ${sharedEnv} npm run db:push && DATABASE_URL=$(cat .playwright-database-url) ${sharedEnv} npm run seed && rm -rf .next && DATABASE_URL=$(cat .playwright-database-url) ${sharedEnv} npm run build && DATABASE_URL=$(cat .playwright-database-url) ${sharedEnv} npm run start -- --hostname 127.0.0.1 --port 3100`,
    port: 3100,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
