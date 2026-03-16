const crypto = require("node:crypto");
const path = require("node:path");

function requireBackendDependency(moduleName) {
  try {
    return require(moduleName);
  } catch {
    const backendModulePath = path.join(
      __dirname,
      "..",
      "..",
      "backend",
      "node_modules",
      moduleName
    );
    return require(backendModulePath);
  }
}

const bcrypt = requireBackendDependency("bcrypt");

const BCRYPT_ROUNDS = 6;

function createTxProxy(entityName) {
  return new Proxy(
    {},
    {
      get: (_target, id) => ({
        update: (data) => ({ _entity: entityName, _id: String(id), _op: "update", data }),
        link: (links) => ({ _entity: entityName, _id: String(id), _op: "link", links }),
        delete: () => ({ _entity: entityName, _id: String(id), _op: "delete" })
      })
    }
  );
}

function sortRows(rows, order) {
  if (!order || Object.keys(order).length === 0) return rows;
  const [rawField, direction] = Object.entries(order)[0];
  const field = rawField === "serverCreatedAt" ? "createdAt" : rawField;
  const factor = direction === "desc" ? -1 : 1;

  return [...rows].sort((left, right) => {
    const a = left[field] ?? 0;
    const b = right[field] ?? 0;
    if (a === b) return 0;
    return a > b ? factor : -factor;
  });
}

function applyQueryOptions(rows, options = {}) {
  const ordered = sortRows(rows, options.order);
  const offset = Number(options.offset || 0);
  const limit = options.limit;
  const sliced = ordered.slice(offset, limit === undefined ? undefined : offset + limit);
  return sliced;
}

function guessMimeType(filePath, providedMimeType) {
  if (providedMimeType) return providedMimeType;
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "image/png";
}

function matchesWhere(candidate, where, matcher) {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => matcher(candidate, key, value));
}

function createLocalInstantStub() {
  const state = {
    authUsers: new Map(),
    authUsersByEmail: new Map(),
    tokens: new Map(),
    profiles: new Map(),
    pairings: new Map(),
    lessons: new Map(),
    lessonNotes: new Map(),
    feedback: new Map(),
    studentSignups: new Map(),
    storage: new Map(),
    sequence: 0
  };

  function nextId(prefix) {
    state.sequence += 1;
    return `${prefix}-${String(state.sequence).padStart(4, "0")}`;
  }

  function ensureAuthUser(email) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingId = state.authUsersByEmail.get(normalizedEmail);
    if (existingId) {
      return state.authUsers.get(existingId);
    }

    const user = {
      id: nextId("auth-user"),
      email: normalizedEmail
    };
    state.authUsers.set(user.id, user);
    state.authUsersByEmail.set(normalizedEmail, user.id);
    return user;
  }

  function mintToken(email) {
    const user = ensureAuthUser(email);
    const token = `qa-token-${crypto.randomUUID()}`;
    state.tokens.set(token, user.id);
    return token;
  }

  function getAuthUserById(id) {
    return id ? state.authUsers.get(id) || null : null;
  }

  function cloneRecord(record) {
    return record ? JSON.parse(JSON.stringify(record)) : record;
  }

  function hydrateProfile(profile) {
    const authUser = getAuthUserById(profile.userId);
    return {
      id: profile.id,
      role: profile.role,
      username: profile.username,
      name: profile.name,
      contact: profile.contact || "",
      passwordHash: profile.passwordHash,
      createdAt: profile.createdAt,
      user: authUser ? [cloneRecord(authUser)] : []
    };
  }

  function hydrateLessonNote(note) {
    return {
      id: note.id,
      text: note.text,
      visibility: note.visibility,
      updatedAt: note.updatedAt
    };
  }

  function hydrateLesson(lesson) {
    const notes = [...state.lessonNotes.values()]
      .filter((note) => note.lessonId === lesson.id)
      .map(hydrateLessonNote);

    return {
      id: lesson.id,
      weekNumber: lesson.weekNumber,
      status: lesson.status,
      evidencePath: lesson.evidencePath || null,
      updatedAt: lesson.updatedAt,
      notes
    };
  }

  function hydrateFeedback(entry) {
    return {
      id: entry.id,
      weekNumber: entry.weekNumber,
      text: entry.text,
      rating: entry.rating,
      visibility: entry.visibility,
      updatedAt: entry.updatedAt
    };
  }

  function hydratePairing(pairing) {
    const teacher = state.profiles.get(pairing.teacherId);
    const student = state.profiles.get(pairing.studentId);
    const lessons = [...state.lessons.values()]
      .filter((lesson) => lesson.pairingId === pairing.id)
      .map(hydrateLesson);
    const feedback = [...state.feedback.values()]
      .filter((entry) => entry.pairingId === pairing.id)
      .map(hydrateFeedback);

    return {
      id: pairing.id,
      createdAt: pairing.createdAt,
      teacher: teacher ? [hydrateProfile(teacher)] : [],
      student: student ? [hydrateProfile(student)] : [],
      lessons,
      feedback
    };
  }

  function filterProfiles(where) {
    return [...state.profiles.values()].filter((profile) =>
      matchesWhere(profile, where, (candidate, key, value) => {
        if (key === "id") return candidate.id === value;
        if (key === "username") return candidate.username === value;
        if (key === "role") return candidate.role === value;
        if (key === "user.id") return candidate.userId === value;
        if (key === "user.email") {
          const user = getAuthUserById(candidate.userId);
          return user?.email === value;
        }
        return false;
      })
    );
  }

  function filterPairings(where) {
    return [...state.pairings.values()].filter((pairing) =>
      matchesWhere(pairing, where, (candidate, key, value) => {
        if (key === "id") return candidate.id === value;
        if (key === "teacher.id") return candidate.teacherId === value;
        if (key === "student.id") return candidate.studentId === value;
        return false;
      })
    );
  }

  function filterLessons(where) {
    return [...state.lessons.values()].filter((lesson) =>
      matchesWhere(lesson, where, (candidate, key, value) => {
        if (key === "id") return candidate.id === value;
        if (key === "weekNumber") return candidate.weekNumber === value;
        if (key === "pairing.id") return candidate.pairingId === value;
        return false;
      })
    );
  }

  function filterFeedback(where) {
    return [...state.feedback.values()].filter((entry) =>
      matchesWhere(entry, where, (candidate, key, value) => {
        if (key === "id") return candidate.id === value;
        if (key === "weekNumber") return candidate.weekNumber === value;
        if (key === "visibility") return candidate.visibility === value;
        if (key === "pairing.id") return candidate.pairingId === value;
        if (key === "student.id") return candidate.studentId === value;
        return false;
      })
    );
  }

  function filterStudentSignups(where) {
    return [...state.studentSignups.values()].filter((signup) =>
      matchesWhere(signup, where, (candidate, key, value) => {
        if (key === "id") return candidate.id === value;
        if (key === "status") return candidate.status === value;
        return false;
      })
    );
  }

  function upsertEntity(map, id, data) {
    const existing = map.get(id) || { id };
    map.set(id, { ...existing, ...cloneRecord(data) });
  }

  async function transact(txns) {
    for (const txn of txns) {
      if (!txn || !txn._entity || !txn._id) continue;
      const entity = txn._entity;
      const id = txn._id;

      if (txn._op === "delete") {
        state[entity]?.delete(id);
        continue;
      }

      if (txn._op === "update") {
        upsertEntity(state[entity], id, txn.data);
        continue;
      }

      if (txn._op === "link") {
        const links = txn.links || {};
        if (entity === "profiles" && links.user) {
          upsertEntity(state.profiles, id, { userId: links.user });
        }
        if (entity === "pairings" && links.teacher) {
          upsertEntity(state.pairings, id, { teacherId: links.teacher });
        }
        if (entity === "pairings" && links.student) {
          upsertEntity(state.pairings, id, { studentId: links.student });
        }
        if (entity === "lessons" && links.pairing) {
          upsertEntity(state.lessons, id, { pairingId: links.pairing });
        }
        if (entity === "lessonNotes" && links.lesson) {
          upsertEntity(state.lessonNotes, id, { lessonId: links.lesson });
        }
        if (entity === "feedback" && links.pairing) {
          upsertEntity(state.feedback, id, { pairingId: links.pairing });
        }
        if (entity === "feedback" && links.student) {
          upsertEntity(state.feedback, id, { studentId: links.student });
        }
      }
    }
  }

  function seedProfile({
    id,
    role,
    username,
    name,
    contact = "",
    passwordHash,
    createdAt,
    userId = null
  }) {
    state.profiles.set(id, {
      id,
      role,
      username,
      name,
      contact,
      passwordHash,
      createdAt,
      userId
    });
  }

  function seedPairing({ id, teacherId, studentId, createdAt }) {
    state.pairings.set(id, {
      id,
      teacherId,
      studentId,
      createdAt
    });
  }

  function seedLesson({ id, pairingId, weekNumber, status, updatedAt, evidencePath = null }) {
    state.lessons.set(id, {
      id,
      pairingId,
      weekNumber,
      status,
      updatedAt,
      evidencePath
    });
  }

  function seedLessonNote({ id, lessonId, text, visibility, updatedAt }) {
    state.lessonNotes.set(id, {
      id,
      lessonId,
      text,
      visibility,
      updatedAt
    });
  }

  function seedFeedback({ id, pairingId, studentId, weekNumber, text, rating, visibility, updatedAt }) {
    state.feedback.set(id, {
      id,
      pairingId,
      studentId,
      weekNumber,
      text,
      rating,
      visibility,
      updatedAt
    });
  }

  function seedSignup({ id, childName, age, phone, contact = "", status, rejectReason = "", createdAt, reviewedAt = null }) {
    state.studentSignups.set(id, {
      id,
      childName,
      age,
      phone,
      contact,
      status,
      rejectReason,
      createdAt,
      reviewedAt
    });
  }

  const credentials = {
    admin: {
      role: "admin",
      identifier: "qa_admin",
      password: "qa-admin-123"
    },
    teacher: {
      role: "teacher",
      identifier: "qa_teacher",
      password: "qa-teacher-123"
    },
    student: {
      role: "student",
      identifier: "qa_student",
      password: "qa-student-123"
    }
  };

  const adminUser = ensureAuthUser("qa_admin.admin@uniquehope.local");
  const teacherUser = ensureAuthUser("qa_teacher.teacher@uniquehope.local");
  const studentUser = ensureAuthUser("qa_student.student@uniquehope.local");

  const now = Date.now();

  seedProfile({
    id: "profile-admin-0001",
    role: "admin",
    username: credentials.admin.identifier,
    name: "QA Admin",
    contact: "admin@uniquehope.local",
    passwordHash: bcrypt.hashSync(credentials.admin.password, BCRYPT_ROUNDS),
    createdAt: now - 20_000,
    userId: adminUser.id
  });

  seedProfile({
    id: "profile-teacher-0001",
    role: "teacher",
    username: credentials.teacher.identifier,
    name: "QA Teacher",
    contact: "Teacher WeChat",
    passwordHash: bcrypt.hashSync(credentials.teacher.password, BCRYPT_ROUNDS),
    createdAt: now - 19_000,
    userId: teacherUser.id
  });

  seedProfile({
    id: "profile-student-0001",
    role: "student",
    username: credentials.student.identifier,
    name: "QA Student",
    contact: "Parent 13800000000",
    passwordHash: bcrypt.hashSync(credentials.student.password, BCRYPT_ROUNDS),
    createdAt: now - 18_000,
    userId: studentUser.id
  });

  seedPairing({
    id: "pairing-0001",
    teacherId: "profile-teacher-0001",
    studentId: "profile-student-0001",
    createdAt: now - 17_000
  });

  seedLesson({
    id: "lesson-0001",
    pairingId: "pairing-0001",
    weekNumber: 1,
    status: "taught",
    updatedAt: now - 16_000
  });

  seedLessonNote({
    id: "lesson-note-0001",
    lessonId: "lesson-0001",
    text: "Initial shared note",
    visibility: "shared",
    updatedAt: now - 16_000
  });

  seedFeedback({
    id: "feedback-0001",
    pairingId: "pairing-0001",
    studentId: "profile-student-0001",
    weekNumber: 1,
    text: "Existing shared feedback",
    rating: 5,
    visibility: "shared",
    updatedAt: now - 15_000
  });

  for (let index = 0; index < 20; index += 1) {
    const teacherId = `profile-teacher-seed-${String(index + 2).padStart(4, "0")}`;
    const studentId = `profile-student-seed-${String(index + 2).padStart(4, "0")}`;
    const pairingId = `pairing-seed-${String(index + 2).padStart(4, "0")}`;
    const lessonId = `lesson-seed-${String(index + 2).padStart(4, "0")}`;
    const createdAt = now - 14_000 + index;

    seedProfile({
      id: teacherId,
      role: "teacher",
      username: `seed_teacher_${index + 1}`,
      name: `Seed Teacher ${index + 1}`,
      contact: "",
      passwordHash: bcrypt.hashSync(`seed-teacher-${index + 1}`, 4),
      createdAt
    });

    seedProfile({
      id: studentId,
      role: "student",
      username: `seed_student_${index + 1}`,
      name: `Seed Student ${index + 1}`,
      contact: `Parent ${(index + 1).toString().padStart(3, "0")}`,
      passwordHash: bcrypt.hashSync(`seed-student-${index + 1}`, 4),
      createdAt
    });

    seedPairing({
      id: pairingId,
      teacherId,
      studentId,
      createdAt
    });

    seedLesson({
      id: lessonId,
      pairingId,
      weekNumber: 1,
      status: index % 3 === 0 ? "taught" : "pending",
      updatedAt: createdAt
    });
  }

  seedSignup({
    id: "00000000-0000-4000-8000-000000000001",
    childName: "QA Public Signup",
    age: 8,
    phone: "13800001111",
    contact: "wechat-public-qa",
    status: "pending",
    createdAt: now - 10_000
  });

  seedSignup({
    id: "00000000-0000-4000-8000-000000000002",
    childName: "QA Reject Candidate",
    age: 9,
    phone: "13800002222",
    contact: "",
    status: "pending",
    createdAt: now - 9_000
  });

  seedSignup({
    id: "00000000-0000-4000-8000-000000000003",
    childName: "QA Approved Existing",
    age: 10,
    phone: "13800003333",
    contact: "approved-contact",
    status: "approved",
    createdAt: now - 8_000,
    reviewedAt: now - 7_000
  });

  const db = {
    async query(spec) {
      if (spec.profiles) {
        const options = spec.profiles.$ || {};
        const profiles = applyQueryOptions(filterProfiles(options.where), options).map(hydrateProfile);
        return { profiles };
      }

      if (spec.pairings) {
        const options = spec.pairings.$ || {};
        const pairings = applyQueryOptions(filterPairings(options.where), options).map(hydratePairing);
        return { pairings };
      }

      if (spec.lessons) {
        const options = spec.lessons.$ || {};
        const lessons = applyQueryOptions(filterLessons(options.where), options).map(hydrateLesson);
        return { lessons };
      }

      if (spec.feedback) {
        const options = spec.feedback.$ || {};
        const feedback = applyQueryOptions(filterFeedback(options.where), options).map(hydrateFeedback);
        return { feedback };
      }

      if (spec.studentSignups) {
        const options = spec.studentSignups.$ || {};
        const studentSignups = applyQueryOptions(filterStudentSignups(options.where), options).map(cloneRecord);
        return { studentSignups };
      }

      return {};
    },
    transact,
    auth: {
      async createToken({ email }) {
        return mintToken(email);
      },
      async getUser({ email }) {
        const normalizedEmail = String(email).trim().toLowerCase();
        const userId = state.authUsersByEmail.get(normalizedEmail);
        return userId ? cloneRecord(state.authUsers.get(userId)) : null;
      },
      async verifyToken(token) {
        const userId = state.tokens.get(token);
        return userId ? cloneRecord(state.authUsers.get(userId)) : null;
      },
      async deleteUser({ id, email }) {
        let userId = id || null;
        if (!userId && email) {
          userId = state.authUsersByEmail.get(String(email).trim().toLowerCase()) || null;
        }
        if (!userId) return;
        const user = state.authUsers.get(userId);
        if (user) {
          state.authUsersByEmail.delete(user.email);
        }
        state.authUsers.delete(userId);
        for (const [token, tokenUserId] of state.tokens.entries()) {
          if (tokenUserId === userId) {
            state.tokens.delete(token);
          }
        }
      }
    },
    storage: {
      async uploadFile(filePath, buffer, mimeType) {
        state.storage.set(filePath, {
          buffer: Buffer.from(buffer),
          mimeType: guessMimeType(filePath, mimeType)
        });
      },
      async delete(filePath) {
        state.storage.delete(filePath);
      },
      async getDownloadUrl(filePath) {
        const entry = state.storage.get(filePath);
        if (!entry) {
          throw new Error(`Missing file: ${filePath}`);
        }
        return `data:${entry.mimeType};base64,${entry.buffer.toString("base64")}`;
      }
    }
  };

  return {
    db,
    id: () => crypto.randomUUID(),
    tx: {
      profiles: createTxProxy("profiles"),
      pairings: createTxProxy("pairings"),
      lessons: createTxProxy("lessons"),
      lessonNotes: createTxProxy("lessonNotes"),
      feedback: createTxProxy("feedback"),
      studentSignups: createTxProxy("studentSignups")
    },
    state,
    credentials
  };
}

module.exports = { createLocalInstantStub };
