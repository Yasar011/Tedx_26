"use client";

import { useAuth } from "@/contexts/AuthContext";
import { isDeptLead } from "@/lib/permissions";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { ROLE_HOME_ROUTE } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
  const { profile, firebaseUser, loading } = useAuth();
  const router = useRouter();

  const allowed = profile?.role === "admin" || isDeptLead(profile);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (profile && !allowed) {
      router.replace(ROLE_HOME_ROUTE[profile.role]);
    }
  }, [loading, firebaseUser, profile, allowed, router]);

  if (loading || !firebaseUser || !profile || !allowed) {
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}
