import { StudentDashboard } from "~/components/student-dashboard";
import { requirePageUser } from "~/server/auth/active-session";

export default async function StudentPage() {
  await requirePageUser("student");

  return <StudentDashboard />;
}
