"use client";

import { RoleGate } from "@/components/auth/RoleGate";

export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allow={["admin", "department_head"]}>{children}</RoleGate>;
}
