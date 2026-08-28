"use client";

import { RoleGate } from "@/components/auth/RoleGate";

export default function CoreLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allow={["admin", "core"]}>{children}</RoleGate>;
}
