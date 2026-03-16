import { i } from "@instantdb/admin";

const _schema = i.schema({
  entities: {
    profiles: i.entity({
      role: i.string(),
      username: i.string().unique(),
      name: i.string(),
      contact: i.string().optional(),
      passwordHash: i.string(),
      createdAt: i.date()
    }),
    pairings: i.entity({
      createdAt: i.date()
    }),
    lessons: i.entity({
      weekNumber: i.number().indexed(),
      status: i.string(),
      evidencePath: i.string().optional(),
      updatedAt: i.date()
    }),
    lessonNotes: i.entity({
      text: i.string(),
      visibility: i.string(),
      updatedAt: i.date()
    }),
    feedback: i.entity({
      weekNumber: i.number().indexed(),
      text: i.string(),
      rating: i.number().optional(),
      visibility: i.string(),
      updatedAt: i.date()
    }),
    studentSignups: i.entity({
      childName: i.string(),
      age: i.number(),
      phone: i.string(),
      contact: i.string().optional(),
      status: i.string(),
      rejectReason: i.string().optional(),
      createdAt: i.date(),
      reviewedAt: i.date().optional()
    })
  },
  links: {
    profileUser: {
      forward: { on: "profiles", has: "one", label: "user" },
      reverse: { on: "$users", has: "one", label: "profile" }
    },
    pairingTeacher: {
      forward: { on: "pairings", has: "one", label: "teacher" },
      reverse: { on: "profiles", has: "one", label: "teacherPairing" }
    },
    pairingStudent: {
      forward: { on: "pairings", has: "one", label: "student" },
      reverse: { on: "profiles", has: "one", label: "studentPairing" }
    },
    lessonPairing: {
      forward: { on: "lessons", has: "one", label: "pairing" },
      reverse: { on: "pairings", has: "many", label: "lessons" }
    },
    lessonNotesLesson: {
      forward: { on: "lessonNotes", has: "one", label: "lesson" },
      reverse: { on: "lessons", has: "one", label: "notes" }
    },
    feedbackPairing: {
      forward: { on: "feedback", has: "one", label: "pairing" },
      reverse: { on: "pairings", has: "many", label: "feedback" }
    },
    feedbackStudent: {
      forward: { on: "feedback", has: "one", label: "student" },
      reverse: { on: "profiles", has: "many", label: "feedback" }
    }
  }
});

export default _schema;
export type Schema = typeof _schema;
