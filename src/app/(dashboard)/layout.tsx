"use client";

import { useAuth } from "@/contexts/AuthContext";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { VerifyEmailScreen } from "@/components/auth/VerifyEmailScreen";
import { ConnectionErrorScreen } from "@/components/auth/ConnectionErrorScreen";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, profile, profileError, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/login");
  }, [loading, firebaseUser, router]);

  if (!loading && firebaseUser && profileError) {
    return <ConnectionErrorScreen message={profileError} />;
  }

  if (loading || !firebaseUser || !profile) return <FullPageSpinner />;

  if (!firebaseUser.emailVerified) {
    return <VerifyEmailScreen email={firebaseUser.email ?? ""} />;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
