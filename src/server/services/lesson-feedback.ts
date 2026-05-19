type FeedbackRow = {
  rating: number | null;
  text: string;
  updatedAt: Date;
  visibility: "private" | "shared";
  weekNumber: number;
};

type LessonRow = {
  status: string;
  weekNumber: number;
};

export function isStudentFeedbackAllowed(status: string | null | undefined) {
  return status === "taught";
}

export function findLatestTeacherVisibleFeedback(
  feedbackRows: FeedbackRow[],
  lessonRows: LessonRow[],
) {
  const taughtWeeks = new Set(
    lessonRows
      .filter((lesson) => isStudentFeedbackAllowed(lesson.status))
      .map((lesson) => lesson.weekNumber),
  );

  return (
    feedbackRows.find(
      (feedback) =>
        feedback.visibility === "shared" &&
        taughtWeeks.has(feedback.weekNumber),
    ) ?? null
  );
}
