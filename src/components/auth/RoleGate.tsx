"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Role } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { ROLE_HOME_ROUTE } from "@/lib/constants";

export function RoleGate({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const { profile, firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (profile && !allow.includes(profile.role)) {
      router.replace(ROLE_HOME_ROUTE[profile.role]);
    }
  }, [loading, firebaseUser, profile, allow, router]);

  if (loading || !firebaseUser || !profile || !allow.includes(profile.role)) {
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}
