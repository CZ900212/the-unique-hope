const UNSAFE_SEED_PASSWORDS = new Set([
  "change-me-now",
  "demo123456",
  "password",
  "123456",
  "admin123",
  "admin123456",
]);

type SeedPolicyInput = {
  adminPassword?: string;
  nodeEnv: string;
  resetExistingPasswords?: string;
  seedDemoData?: string;
};

export function isUnsafeSeedPassword(password: string) {
  const normalized = password.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized.startsWith("replace-with-") ||
    UNSAFE_SEED_PASSWORDS.has(normalized)
  );
}

export function resolveSeedPolicy(input: SeedPolicyInput) {
  const adminPassword = input.adminPassword?.trim();
  if (!adminPassword) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is required before running the seed script.",
    );
  }

  if (isUnsafeSeedPassword(adminPassword)) {
    throw new Error(
      "SEED_ADMIN_PASSWORD must be replaced with a unique non-placeholder password before seeding.",
    );
  }

  const seedDemoData = input.seedDemoData === "true";
  if (input.nodeEnv === "production" && seedDemoData) {
    throw new Error("SEED_DEMO_DATA must remain false in production.");
  }

  return {
    adminPassword,
    resetExistingPasswords: input.resetExistingPasswords === "true",
    seedDemoData,
  };
}
