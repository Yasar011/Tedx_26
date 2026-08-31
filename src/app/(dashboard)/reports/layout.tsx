"use client";

import { RoleGate } from "@/components/auth/RoleGate";

/**
 * Reports aggregate every department's recruitment and task data, so this
 * is org leadership only. Without this gate the route was reachable by URL
 * for any signed-in user, including Department Heads — who are meant to be
 * scoped to their own department.
 *
 * Firestore rules would have rejected most of the underlying reads anyway,
 * but that produced a broken page rather than a clear refusal, and relying
 * on that alone leaves the boundary implicit.
 */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allow={["admin", "core"]}>{children}</RoleGate>;
}
