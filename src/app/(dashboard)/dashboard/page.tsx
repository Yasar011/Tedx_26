"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ROLE_HOME_ROUTE } from "@/lib/constants";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardRedirect() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile) router.replace(ROLE_HOME_ROUTE[profile.role]);
  }, [loading, profile, router]);

  return <FullPageSpinner />;
}
