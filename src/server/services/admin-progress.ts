import { TOTAL_WEEKS } from "~/lib/domain";

type PairingLesson = {
  status: string;
  weekNumber: number;
};

type PairingProfile = {
  contact?: string | null;
  id: string;
  name: string;
  role: string;
  userId: string;
  username: string;
};

type PairingWithLessons = {
  createdAt: Date;
  id: string;
  lessons: PairingLesson[];
  student: PairingProfile | null;
  teacher: PairingProfile | null;
};

export function serializeAdminPairingProgress(pairing: PairingWithLessons) {
  const taughtCount = pairing.lessons.filter((lesson) => lesson.status === "taught").length;

  return {
    id: pairing.id,
    createdAt: pairing.createdAt,
    teacher: pairing.teacher,
    student: pairing.student,
    progress: {
      taughtCount,
      totalWeeks: TOTAL_WEEKS,
      lessons: pairing.lessons.map((lesson) => ({
        weekNumber: lesson.weekNumber,
        status: lesson.status,
      })),
    },
  };
}

export function buildAdminProgressReport(rows: PairingWithLessons[]) {
  return {
    totalPairings: rows.length,
    pairings: rows.map(serializeAdminPairingProgress),
  };
}
