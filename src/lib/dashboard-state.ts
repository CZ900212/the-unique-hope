type StudentWeek = {
  hasEvidence: boolean;
  status: string;
  weekNumber: number;
};

type TeacherLesson = {
  status: string;
  week_number: number;
};

export function getDefaultTeacherWeek(lessons: readonly TeacherLesson[]) {
  if (lessons.length === 0) {
    return 1;
  }

  const sorted = [...lessons].sort((left, right) => left.week_number - right.week_number);
  const last = sorted.at(-1)!;

  if (last.status === "taught" && last.week_number < 20) {
    return last.week_number + 1;
  }

  return last.week_number;
}

export function getDefaultStudentWeek(weeks: readonly StudentWeek[]) {
  const taught = [...weeks]
    .filter((week) => week.status === "taught")
    .sort((left, right) => right.weekNumber - left.weekNumber)[0];
  if (taught) {
    return taught.weekNumber;
  }

  const withEvidence = [...weeks]
    .filter((week) => week.hasEvidence)
    .sort((left, right) => right.weekNumber - left.weekNumber)[0];
  if (withEvidence) {
    return withEvidence.weekNumber;
  }

  return 1;
}
