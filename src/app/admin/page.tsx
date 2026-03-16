import { AdminDashboard } from "~/components/admin-dashboard";
import { getActiveUserSession } from "~/server/auth/active-session";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const active = await getActiveUserSession();
  if (!active) {
    redirect("/admin/login");
  }

  if (active.profile.role !== "admin") {
    redirect(`/${active.profile.role}`);
  }

  return <AdminDashboard />;
}
