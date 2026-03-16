/**
 * Create demo user profiles in InstantDB.
 *
 * Run with: node scripts/create-profiles.js
 */

const bcrypt = require("bcrypt");
const { db, id, tx } = require("../src/lib/instant");
const { env } = require("../src/config/env");

const BCRYPT_ROUNDS = 12;

const PROFILES = [
  {
    role: "admin",
    username: "demo_admin",
    name: "Demo Admin",
    contact: "demo_admin@uniquehope.local",
    password: "demo123456"
  },
  {
    role: "teacher",
    username: "demo_teacher",
    name: "Demo Teacher",
    contact: "demo_teacher@uniquehope.local",
    password: "demo123456"
  },
  {
    role: "student",
    username: "demo_student",
    name: "Demo Student",
    contact: "demo_student@uniquehope.local",
    password: "demo123456"
  }
];

function canonicalEmail(username, role) {
  return `${username}.${role}@${env.AUTH_LOCAL_EMAIL_DOMAIN}`.toLowerCase();
}

async function ensureAuthUser(email) {
  await db.auth.createToken({ email });
  const user = await db.auth.getUser({ email });
  if (!user?.id) {
    throw new Error(`Failed to resolve auth user for ${email}`);
  }
  return user;
}

async function upsertProfile(profile) {
  const email = canonicalEmail(profile.username, profile.role);
  const authUser = await ensureAuthUser(email);

  const { profiles } = await db.query({
    profiles: {
      $: { where: { username: profile.username } },
      user: {}
    }
  });

  const existing = profiles?.[0] || null;
  const profileId = existing?.id || id();
  const passwordHash = await bcrypt.hash(profile.password, BCRYPT_ROUNDS);
  const now = Date.now();

  await db.transact([
    tx.profiles[profileId].update({
      role: profile.role,
      username: profile.username,
      name: profile.name,
      contact: profile.contact,
      passwordHash,
      createdAt: existing?.createdAt || now
    }),
    tx.profiles[profileId].link({ user: authUser.id })
  ]);

  console.log(`Created/updated profile: ${profile.username} (${profile.role})`);
}

async function createProfiles() {
  console.log("Creating demo user profiles...\n");

  for (const profile of PROFILES) {
    await upsertProfile(profile);
  }

  console.log("\nAll demo profiles created successfully.");
  console.log("\nDemo credentials:");
  console.log("Admin: demo_admin / demo123456");
  console.log("Teacher: demo_teacher / demo123456");
  console.log("Student: demo_student / demo123456");
}

createProfiles().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
