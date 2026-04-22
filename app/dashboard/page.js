import { redirect } from "next/navigation";

import ClosetDashboard from "@/components/closet-dashboard";
import { getServerSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  return <ClosetDashboard session={session} />;
}
