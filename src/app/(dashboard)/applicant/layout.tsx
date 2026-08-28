"use client";

import { RoleGate } from "@/components/auth/RoleGate";

export default function ApplicantLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allow={["applicant"]}>{children}</RoleGate>;
}
