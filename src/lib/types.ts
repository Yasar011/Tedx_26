export type Role =
  | "admin"
  | "core"
  | "department_head"
  | "volunteer"
  | "applicant"
  | "unassigned";

export type ApplicationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "SHORTLISTED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_COMPLETED"
  | "CORE_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "WAITLISTED";

export type Recommendation = "SELECT" | "REJECT" | "WAITLIST";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: Role;
  departmentId: string | null;
  tedxId: string | null;
  status: "active" | "inactive";
  createdAt: number;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  purpose?: string;
  responsibilities?: string;
  goals?: string;
  guidelines?: string;
  headUserId: string | null;
  active: boolean;
  applicationsOpen: boolean;
  createdAt: number;
}

export interface Application {
  id: string;
  applicantUserId: string;
  name: string;
  email: string;
  phone: string;
  programme: string;
  semester: string;
  departmentPreference: string;
  departmentPreference2: string;
  skills: string;
  experience: string;
  portfolio: string;
  why: string;
  availability: string;
  status: ApplicationStatus;
  createdAt: number;
  updatedAt: number;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
}

export interface InterviewRatings {
  communication: number;
  creativity: number;
  teamwork: number;
  skills: number;
  availability: number;
  overall: number;
}

export interface Interview {
  id: string;
  applicationId: string;
  departmentId: string;
  interviewerUserId: string;
  interviewerName: string;
  scheduledAt: number | null;
  notes: string;
  ratings: InterviewRatings | null;
  recommendation: Recommendation | null;
  submittedAt: number | null;
  coreDecision: {
    decidedBy: string;
    decidedByName: string;
    decision: "APPROVED" | "REJECTED" | "WAITLISTED" | "SENT_BACK";
    comment: string;
    decidedAt: number;
  } | null;
  createdAt: number;
}

export interface EventSettings {
  eventName: string;
  year: number;
  theme: string;
  eventDate: string;
  memberIdFormat: string;
  applicationsOpen: boolean;
  updatedAt: number;
}

export interface ActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  message: string;
  departmentId?: string | null;
  createdAt: number;
}
