/**
 * Bootstrap the first admin profile in InstantDB.
 *
 * Required env:
 * - BOOTSTRAP_ADMIN_USERNAME
 * - BOOTSTRAP_ADMIN_PASSWORD
 *
 * Optional env:
 * - BOOTSTRAP_ADMIN_NAME
 * - BOOTSTRAP_ADMIN_CONTACT
 * - BOOTSTRAP_ADMIN_EMAIL
 */

const bcrypt = require("bcrypt");
const { z } = require("zod");
const { db, id, tx } = require("../src/lib/instant");
const { env } = require("../src/config/env");
const { usernameSchema } = require("../src/utils/validators");

const BCRYPT_ROUNDS = 12;
const passwordSchema = z.string().min(6).max(128);
const emailSchema = z.email();

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalEnv(name) {
  const value = process.env[name]?.trim();
  return value || "";
}

function canonicalAdminEmail(username) {
  return `${username}.admin@${env.AUTH_LOCAL_EMAIL_DOMAIN}`.toLowerCase();
}

function readBootstrapConfig() {
  const username = usernameSchema.parse(requireEnv("BOOTSTRAP_ADMIN_USERNAME"));
  const password = passwordSchema.parse(requireEnv("BOOTSTRAP_ADMIN_PASSWORD"));
  const providedEmail = optionalEnv("BOOTSTRAP_ADMIN_EMAIL");
  const email = emailSchema.parse(providedEmail || canonicalAdminEmail(username)).toLowerCase();
  const name = optionalEnv("BOOTSTRAP_ADMIN_NAME");
  const contact = optionalEnv("BOOTSTRAP_ADMIN_CONTACT");

  return {
    username,
    password,
    email,
    name,
    contact
  };
}

async function findProfileByUsername(username) {
  const { profiles } = await db.query({
    profiles: {
      $: { where: { username } },
      user: {}
    }
  });

  return profiles?.[0] || null;
}

async function findProfileByEmail(email) {
  const { profiles } = await db.query({
    profiles: {
      $: { where: { "user.email": email } },
      user: {}
    }
  });

  return profiles?.[0] || null;
}

async function listAdminProfiles() {
  const { profiles } = await db.query({
    profiles: {
      $: { where: { role: "admin" } },
      user: {}
    }
  });

  return profiles || [];
}

async function ensureAuthUser(email) {
  const existing = await db.auth.getUser({ email });
  if (existing?.id) {
    return existing;
  }

  await db.auth.createToken({ email });
  const created = await db.auth.getUser({ email });
  if (!created?.id) {
    throw new Error(`Failed to create auth user for ${email}`);
  }

  return created;
}

function resolveExistingProfile(existingByUsername, existingByEmail) {
  if (
    existingByUsername &&
    existingByEmail &&
    existingByUsername.id !== existingByEmail.id
  ) {
    throw new Error(
      `Bootstrap conflict: username "${existingByUsername.username}" and email "${existingByEmail.user?.[0]?.email || "unknown"}" resolve to different profiles.`
    );
  }

  return existingByUsername || existingByEmail || null;
}

function assertProfileCompatibility(profile, field, value) {
  if (profile && profile.role !== "admin") {
    throw new Error(
      `${field} "${value}" is already assigned to ${profile.role} profile "${profile.username}".`
    );
  }
}

async function bootstrapAdmin() {
  if (!env.INSTANT_CONFIGURED) {
    throw new Error(
      "InstantDB is not configured. Set INSTANT_APP_ID and INSTANT_ADMIN_TOKEN before bootstrapping an admin."
    );
  }

  const config = readBootstrapConfig();
  const [existingByUsername, existingByEmail, admins] = await Promise.all([
    findProfileByUsername(config.username),
    findProfileByEmail(config.email),
    listAdminProfiles()
  ]);

  assertProfileCompatibility(existingByUsername, "Username", config.username);
  assertProfileCompatibility(existingByEmail, "Email", config.email);

  const existing = resolveExistingProfile(existingByUsername, existingByEmail);
  const otherAdmins = admins.filter((profile) => profile.id !== existing?.id);

  if (!existing && otherAdmins.length > 0) {
    const usernames = otherAdmins.map((profile) => profile.username).join(", ");
    console.log(
      `Admin bootstrap skipped: existing admin profile(s) already present (${usernames}).`
    );
    return;
  }

  const authUser = await ensureAuthUser(config.email);
  const profileId = existing?.id || id();
  const passwordHash = await bcrypt.hash(config.password, BCRYPT_ROUNDS);
  const now = Date.now();
  const name = config.name || existing?.name || "Administrator";
  const contact = config.contact || existing?.contact || config.email;

  await db.transact([
    tx.profiles[profileId].update({
      role: "admin",
      username: config.username,
      name,
      contact,
      passwordHash,
      createdAt: existing?.createdAt || now
    }),
    tx.profiles[profileId].link({ user: authUser.id })
  ]);

  console.log(
    `${existing ? "Updated" : "Created"} admin profile "${config.username}" (${profileId}).`
  );
  console.log(`Auth email: ${config.email}`);
}

bootstrapAdmin().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
