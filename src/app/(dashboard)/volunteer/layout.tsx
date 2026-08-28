"use client";

import { RoleGate } from "@/components/auth/RoleGate";

export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allow={["volunteer"]}>{children}</RoleGate>;
}
