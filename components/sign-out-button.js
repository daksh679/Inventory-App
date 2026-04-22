"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { authClient } from "@/lib/auth-client";

export default function SignOutButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSignOut() {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/sign-in");
      router.refresh();
    });
  }

  return (
    <button className="button ghost" disabled={isPending} onClick={handleSignOut} type="button">
      {isPending ? "Signing out..." : "Sign Out"}
    </button>
  );
}
