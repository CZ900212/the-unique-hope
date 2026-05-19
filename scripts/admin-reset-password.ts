import { randomBytes } from "node:crypto";

import { conn } from "~/server/db";
import { resetAdminPassword } from "~/server/auth/admin-password-reset";

function readArg(flag: string) {
  const index = process.argv.findIndex((value) => value === flag);
  if (index < 0) {
    return null;
  }

  const value = process.argv[index + 1]?.trim();
  return value && value.length > 0 ? value : null;
}

async function main() {
  const identifier = readArg("--identifier");
  if (!identifier) {
    throw new Error(
      "Usage: npm run admin:reset-password -- --identifier <email|username> [--password <new-password>]",
    );
  }

  const password =
    readArg("--password") ?? randomBytes(18).toString("base64url");
  const account = await resetAdminPassword({
    identifier,
    password,
  });

  console.log("Admin password reset complete.");
  console.log(`Admin username: ${account.username}`);
  console.log(`Admin email: ${account.email}`);
  console.log(`Admin user id: ${account.userId}`);
  console.log(`New password: ${password}`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await conn.end({ timeout: 5 });
  });
