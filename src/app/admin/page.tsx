import { AdminDashboard } from "~/components/admin-dashboard";
import { requirePageUser } from "~/server/auth/active-session";

export default async function AdminPage() {
  await requirePageUser("admin");

  return <AdminDashboard />;
}
