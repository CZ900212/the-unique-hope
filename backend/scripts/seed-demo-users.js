/**
 * Demo Accounts Seed Script for InstantDB.
 *
 * Run with: node scripts/seed-demo-users.js
 */

const bcrypt = require("bcrypt");
const { db, id, tx } = require("../src/lib/instant");
const { env } = require("../src/config/env");

const BCRYPT_ROUNDS = 12;

const DEMO_USERS = [
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

async function upsertProfile(user) {
  const email = canonicalEmail(user.username, user.role);
  const authUser = await ensureAuthUser(email);

  const { profiles } = await db.query({
    profiles: {
      $: { where: { username: user.username } },
      user: {}
    }
  });

  const existing = profiles?.[0] || null;
  const profileId = existing?.id || id();
  const passwordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
  const now = Date.now();

  await db.transact([
    tx.profiles[profileId].update({
      role: user.role,
      username: user.username,
      name: user.name,
      contact: user.contact,
      passwordHash,
      createdAt: existing?.createdAt || now
    }),
    tx.profiles[profileId].link({ user: authUser.id })
  ]);

  return profileId;
}

async function ensurePairing(teacherProfileId, studentProfileId) {
  const { pairings } = await db.query({
    pairings: {
      $: {
        where: {
          "teacher.id": teacherProfileId,
          "student.id": studentProfileId
        }
      }
    }
  });

  if (pairings?.[0]?.id) {
    return pairings[0].id;
  }

  const pairingId = id();
  const now = Date.now();

  await db.transact([
    tx.pairings[pairingId].update({ createdAt: now }),
    tx.pairings[pairingId].link({ teacher: teacherProfileId }),
    tx.pairings[pairingId].link({ student: studentProfileId })
  ]);

  return pairingId;
}

async function seedDemoUsers() {
  console.log("Seeding demo users...\n");

  const profileIds = {};
  for (const user of DEMO_USERS) {
    const profileId = await upsertProfile(user);
    profileIds[user.role] = profileId;
    console.log(`Created/updated ${user.role} profile: ${user.username}`);
  }

  const pairingId = await ensurePairing(profileIds.teacher, profileIds.student);

  console.log("\nDemo seed complete.");
  console.log(`Pairing ID: ${pairingId}`);
  console.log("\nDemo credentials:");
  console.log("Admin: demo_admin / demo123456");
  console.log("Teacher: demo_teacher / demo123456");
  console.log("Student: demo_student / demo123456");
}

seedDemoUsers().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
