import {
  ApplicationStatus,
  IssuePriority,
  IssueStatus,
  Role,
  TaskPriority,
  TaskStatus,
} from "./types";

/**
 * Bootstrap Admin. Security rules deliberately prevent anyone from making
 * themselves an admin, which leaves a chicken-and-egg problem for the very
 * first one. This UID is treated as an Admin both here and in
 * firestore.rules (keep the two in sync). Every subsequent role is assigned
 * in-app from Admin > Team — this is only for the founding account.
 */
export const FOUNDING_ADMIN_UID =
  process.env.NEXT_PUBLIC_FOUNDING_ADMIN_UID || "a8WrtFFMddUQ8mCCRV2znQfqDFI2";


export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  SHORTLISTED: "Shortlisted",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  CORE_REVIEW: "Core Approval Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WAITLISTED: "Waitlisted",
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  SUBMITTED: "bg-neutral-100 text-neutral-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  SHORTLISTED: "bg-indigo-100 text-indigo-700",
  INTERVIEW_SCHEDULED: "bg-purple-100 text-purple-700",
  INTERVIEW_COMPLETED: "bg-violet-100 text-violet-700",
  CORE_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  WAITLISTED: "bg-yellow-100 text-yellow-700",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  core: "Core Organizing Team",
  department_head: "Department Head",
  volunteer: "Volunteer",
  applicant: "Applicant",
  unassigned: "Unassigned",
};

export const ROLE_HOME_ROUTE: Record<Role, string> = {
  admin: "/admin/command-center",
  core: "/core/approvals",
  department_head: "/department",
  volunteer: "/volunteer",
  applicant: "/applicant",
  unassigned: "/pending",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TO_DO: "To Do",
  IN_PROGRESS: "In Progress",
  SUBMITTED_FOR_REVIEW: "Submitted for Review",
  REVISION_REQUIRED: "Revision Required",
  APPROVED: "Approved",
  COMPLETED: "Completed",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  TO_DO: "bg-neutral-100 text-neutral-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  SUBMITTED_FOR_REVIEW: "bg-amber-100 text-amber-700",
  REVISION_REQUIRED: "bg-red-100 text-red-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-neutral-800 text-white",
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: "bg-neutral-100 text-neutral-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  REPORTED: "Reported",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
};

export const ISSUE_STATUS_COLORS: Record<IssueStatus, string> = {
  REPORTED: "bg-red-100 text-red-700",
  ASSIGNED: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
};

export const ISSUE_PRIORITY_COLORS: Record<IssuePriority, string> = {
  LOW: "bg-neutral-100 text-neutral-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export { DEFAULT_DEPARTMENTS } from "./defaultDepartments";

export const TEDX_BRAND_RED = "#EB0028";

// Cloudinary free-plan limits (enforced client-side before upload in Phase 2)
export const CLOUDINARY_LIMITS = {
  maxImageBytes: 10 * 1024 * 1024, // 10 MB
  maxVideoBytes: 100 * 1024 * 1024, // 100 MB
  maxRawBytes: 10 * 1024 * 1024, // 10 MB
  maxImageMegapixels: 25,
  monthlyCredits: 25,
};
