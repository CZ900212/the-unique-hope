import { TeacherDashboard } from "~/components/teacher-dashboard";
import { requirePageUser } from "~/server/auth/active-session";

export default async function TeacherPage() {
  await requirePageUser("teacher");

  return <TeacherDashboard />;
}
