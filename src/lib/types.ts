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
  /** Grants this person the same department-scoped permissions as a
   *  Department Head, on top of their existing role. Set by Admin. */
  isCoHead?: boolean;
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

// ---------- PHASE 2: TASKS ----------

export type TaskStatus =
  | "TO_DO"
  | "IN_PROGRESS"
  | "SUBMITTED_FOR_REVIEW"
  | "REVISION_REQUIRED"
  | "APPROVED"
  | "COMPLETED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface TaskAttachment {
  fileId: string;
  url: string;
  fileName: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  departmentId: string;
  departmentName: string;
  assignedTo: string | null;
  assignedToName: string | null;
  createdBy: string;
  createdByName: string;
  priority: TaskPriority;
  startDate: number | null;
  deadline: number | null;
  status: TaskStatus;
  attachments: TaskAttachment[];
  dependsOn: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  message: string;
  createdAt: number;
}

// ---------- PHASE 2: FILES (CLOUDINARY) ----------

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface FileAsset {
  id: string;
  cloudinaryUrl: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName: string;
  departmentId: string | null;
  uploadedAt: number;
  relatedTaskId: string | null;
  folder: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: string | null;
  approvedByName?: string | null;
}

// ---------- PHASE 2: ANNOUNCEMENTS ----------

export type AnnouncementScope = "org" | "department";
export type AnnouncementPriority = "NORMAL" | "IMPORTANT" | "URGENT";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  authorId: string;
  authorName: string;
  scope: AnnouncementScope;
  departmentId: string | null;
  priority: AnnouncementPriority;
  createdAt: number;
}

// ---------- PHASE 2: NOTIFICATIONS ----------

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  relatedId: string | null;
  link: string | null;
  read: boolean;
  createdAt: number;
}

// ---------- PHASE 3: MEETINGS ----------

export interface ActionItem {
  id: string;
  text: string;
  assignedTo: string | null;
  assignedToName: string | null;
  taskId: string | null;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  attendees: string[];
  agenda: string;
  notes: string;
  decisions: string;
  actionItems: ActionItem[];
  createdBy: string;
  createdByName: string;
  createdAt: number;
}

// ---------- PHASE 3: KNOWLEDGE BASE ----------

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  order: number;
  updatedBy: string;
  updatedAt: number;
}

// ---------- PHASE 4: EVENT DAY CONTROL ROOM ----------

export type OpsStatus = "READY" | "ACTIVE" | "ISSUE" | "OFFLINE";

export interface EventDayState {
  isLive: boolean;
  currentSession: string;
  nextSession: string;
  stageStatus: OpsStatus;
  avStatus: OpsStatus;
  photographyStatus: OpsStatus;
  hospitalityStatus: OpsStatus;
  operationsStatus: OpsStatus;
  technicalStatus: OpsStatus;
  registrationCount: number;
  registrationTarget: number;
  updatedAt: number;
}

// ---------- DIRECT MESSAGES ----------

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: number;
}

// ---------- PHASE 4: INCIDENTS ----------

export type IssueStatus = "REPORTED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED";
export type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Issue {
  id: string;
  title: string;
  location: string;
  departmentId: string | null;
  priority: IssuePriority;
  reportedBy: string;
  reportedByName: string;
  description: string;
  attachmentUrl: string | null;
  status: IssueStatus;
  assignedTo: string | null;
  assignedToName: string | null;
  createdAt: number;
  updatedAt: number;
}
