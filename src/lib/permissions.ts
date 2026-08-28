import { UserProfile } from "./types";

/**
 * A "department lead" is either the official Department Head or a
 * Co-Head — both get identical department-scoped permissions
 * (interviews, tasks, files, announcements). Co-Head is a flag on top
 * of a person's existing role, not a separate role, so it composes
 * cleanly with whatever base role they already hold.
 */
export function isDeptLead(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return profile.role === "department_head" || profile.isCoHead === true;
}

export function isDeptLeadOf(profile: UserProfile | null, departmentId: string | null | undefined): boolean {
  if (!profile || !departmentId) return false;
  return isDeptLead(profile) && profile.departmentId === departmentId;
}
