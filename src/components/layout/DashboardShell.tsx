"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        role={profile.role}
        isCoHead={!!profile.isCoHead}
        hasDepartment={!!profile.departmentId}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
