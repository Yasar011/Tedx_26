import { ApplicationStatus, Role } from "./types";

export const DEFAULT_DEPARTMENTS = [
  { name: "PR & Outreach", code: "PR" },
  { name: "Sponsorship", code: "SP" },
  { name: "Social Media", code: "SM" },
  { name: "Content", code: "CN" },
  { name: "Design", code: "DS" },
  { name: "Technical", code: "TC" },
  { name: "Photography", code: "PH" },
  { name: "Videography", code: "VD" },
  { name: "Operations", code: "OP" },
  { name: "Hospitality", code: "HP" },
  { name: "Stage Management", code: "ST" },
  { name: "Logistics", code: "LG" },
];

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

export const TEDX_BRAND_RED = "#EB0028";

// Cloudinary free-plan limits (enforced client-side before upload in Phase 2)
export const CLOUDINARY_LIMITS = {
  maxImageBytes: 10 * 1024 * 1024, // 10 MB
  maxVideoBytes: 100 * 1024 * 1024, // 100 MB
  maxRawBytes: 10 * 1024 * 1024, // 10 MB
  maxImageMegapixels: 25,
  monthlyCredits: 25,
};
