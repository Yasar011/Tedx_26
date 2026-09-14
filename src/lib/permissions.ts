import { UserProfile } from "./types";

/**
 * Someone who runs a department day-to-day, and so gets the
 * department-scoped powers (interviews, tasks, files, announcements):
 *
 *  - the official Department Head;
 *  - a Co-Head, which is a flag layered on top of an existing role rather
 *    than a role of its own;
 *  - an Admin or Core member who has also been assigned to a department —
 *    e.g. the Admin who additionally runs Technical. Org-level roles are
 *    not mutually exclusive with leading a department.
 */
export function isDeptLead(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.role === "department_head") return true;
  if (profile.isCoHead === true) return true;
  return (profile.role === "admin" || profile.role === "core") && !!profile.departmentId;
}

export function isDeptLeadOf(
  profile: UserProfile | null,
  departmentId: string | null | undefined
): boolean {
  if (!profile || !departmentId) return false;
  return isDeptLead(profile) && profile.departmentId === departmentId;
}

/** Whether this person also holds a department alongside an org-level role. */
export function hasOwnDepartment(profile: UserProfile | null): boolean {
  return !!profile?.departmentId;
}

/**
 * Org-level leadership, matching isCore() in firestore.rules.
 *
 * Worth knowing on the client because security rules are not filters: a
 * query is permitted only when its own constraints prove every match is
 * readable. Core clears that on its own; everyone else has to put the
 * constraint the rule names into the query itself.
 */
export function isOrgLeadership(profile: UserProfile | null): boolean {
  return profile?.role === "admin" || profile?.role === "core";
}
