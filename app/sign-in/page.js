import { redirect } from "next/navigation";

import AuthScreen from "@/components/auth-screen";
import { getServerSession } from "@/lib/session";

export default async function SignInPage({ searchParams }) {
  const session = await getServerSession();

  if (session) {
    redirect("/dashboard");
  }

  const resolvedParams = await searchParams;
  const mode = resolvedParams?.mode === "signup" ? "signup" : "signin";

  return <AuthScreen initialMode={mode} />;
}
